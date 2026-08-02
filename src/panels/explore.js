import { select } from 'd3-selection'
import { scaleLinear } from 'd3-scale'
import { extent } from 'd3-array'
import { interpolateBlues, interpolateRdBu } from 'd3-scale-chromatic'
import { FACTOR_LIST, FACTORS } from '../data/factors.js'
import { createCensusClient } from '../data/censusClient.js'
import { REGION_OF } from '../data/regions.js'
import { pearson, linearRegression, mean } from '../lib/stats.js'

// Small-multiples "Explore" panel. Pick one lens factor, then see every other numeric
// factor plotted against it in a grid of mini-charts, so you can eyeball at a glance
// which factors move with the lens. The chart type follows the lens:
//   • categorical lens (state trifecta) -> grouped R / Divided / D dot columns
//   • continuous lens (vote margin, income, …) -> scatter with a best-fit line + r
// Dots are colored by the lens's own palette (red/purple/blue for party, red↔blue for
// margin, a blues ramp otherwise), and everything is scoped to the areas on screen.

const MW = 150, MH = 104, PAD = 8, PADB = 8
const CAT_COLOR = { R: '#c1362f', divided: '#b39ec4', D: '#2f5fc1' }
const CAT_ORDER = ['R', 'divided', 'D']
const CAT_LABEL = { R: 'R', divided: 'Div', D: 'D' }

// Lens factors offered, party-first. A lens can be categorical (trifecta), diverging
// (vote margin) or any numeric factor.
const LENS_FIRST = ['trifecta', 'vote_margin']
const lensOptions = () => [
  ...LENS_FIRST.map((id) => FACTORS[id]).filter(Boolean),
  ...FACTOR_LIST.filter((f) => !LENS_FIRST.includes(f.id))
]

const isCategorical = (f) => f?.scale === 'categorical'
const isDiverging = (f) => f?.scale === 'diverging'

export function createExplorePanel({ client = createCensusClient(), geo, sources = {} } = {}) {
  let el = null
  let store = null
  let unsub = null
  let lens = 'trifecta'
  let within = false
  let lastKey = null
  let reqId = 0

  const regionOf = (id) => REGION_OF[id.length === 5 ? id.slice(0, 2) : id]

  // Region-adjust: replace each requested axis with its deviation from the point's Census
  // region mean, so the chart compares like-with-like (a Southern D state vs Southern R
  // states, not vs the urban Northeast). Subtracting a constant per region leaves r and
  // the slope untouched within a region while removing the between-region confound. The
  // original lens value is preserved as `xRaw` so dots stay colored by the real value.
  const demeanByRegion = (rows, axes) => {
    const sums = {}
    const counts = {}
    for (const r of rows) {
      const reg = regionOf(r.id)
      for (const ax of axes) {
        if (!Number.isFinite(r[ax])) continue
        const k = `${reg}|${ax}`
        sums[k] = (sums[k] ?? 0) + r[ax]
        counts[k] = (counts[k] ?? 0) + 1
      }
    }
    return rows.map((r) => {
      const reg = regionOf(r.id)
      const out = { ...r }
      for (const ax of axes) {
        const k = `${reg}|${ax}`
        if (Number.isFinite(r[ax]) && counts[k]) out[ax] = r[ax] - sums[k] / counts[k]
      }
      return out
    })
  }

  const viewKey = () => {
    const s = store.getState()
    return `${lens}|${s.geoLevel}|${s.selectedState}|${s.year}|${s.electionYear}`
  }

  // One fetch shape for either kind of factor (census client or a bundled source).
  const fetchRows = (f, s) =>
    f.source
      ? (sources[f.source]?.fetchFactor({
          geoLevel: s.geoLevel, selectedState: s.selectedState,
          electionYear: s.electionYear, year: s.year, metric: f.metric
        }) ?? Promise.resolve([]))
      : client.fetchFactor({
          variable: f.variable, variables: f.variables, compute: f.compute,
          dataset: f.dataset, geoLevel: s.geoLevel, year: s.year
        })

  const scoper = (s) => {
    const ids = geo ? new Set(geo.featureIds(s.geoLevel, s.selectedState)) : null
    return (rows) => {
      const m = {}
      for (const r of rows) if (!ids || ids.has(r.id)) m[r.id] = { value: r.value, name: r.name }
      return m
    }
  }

  const compute = async () => {
    const s = store.getState()
    const lensF = FACTORS[lens]
    el.querySelector('.mini-grid').innerHTML = '<p class="corr-loading">Building charts…</p>'
    const my = ++reqId

    const scoped = scoper(s)
    const lensById = scoped(await fetchRows(lensF, s).catch(() => []))
    const grouped = isCategorical(lensF)
    const diverging = isDiverging(lensF)

    // The lens x-axis values (numeric mode) and its color scale, shared by every chart.
    const lensVals = grouped ? [] : Object.values(lensById).map((v) => v.value).filter(Number.isFinite)
    const [lxMin, lxMax] = grouped ? [0, 0] : extent(lensVals)
    const lensColor = (v) => {
      if (grouped) return CAT_COLOR[v] ?? '#c3ccdb'
      if (!Number.isFinite(v)) return '#c3ccdb'
      if (diverging) {
        const m = Math.max(Math.abs(lxMin ?? 0), Math.abs(lxMax ?? 0)) || 1
        return interpolateRdBu((v + m) / (2 * m))
      }
      const span = (lxMax - lxMin) || 1
      return interpolateBlues(0.15 + 0.85 * ((v - lxMin) / span))
    }

    const others = FACTOR_LIST.filter((f) => !f.scale && f.id !== lens)
    const charts = await Promise.all(
      others.map(async (f) => {
        const yById = scoped(await fetchRows(f, s).catch(() => []))
        const ids = Object.keys(lensById).filter((id) => yById[id]?.value != null)
        let rows = ids.map((id) => ({
          id, name: yById[id].name ?? lensById[id].name ?? id,
          x: lensById[id].value, xRaw: lensById[id].value, y: yById[id].value
        }))
        // Grouped mode adjusts the factor (y) only; scatter adjusts both axes.
        if (within) rows = demeanByRegion(rows, grouped ? ['y'] : ['x', 'y'])
        if (grouped) return groupedChart(f, rows)
        return scatterChart(f, rows)
      })
    )
    if (my !== reqId) return

    const ranked = charts
      .filter((c) => c && c.sortKey != null)
      .sort((a, b) => b.sortKey - a.sortKey)
    render(ranked, grouped, lensColor)
  }

  // A scatter chart's data: dots, Pearson r, OLS fit. sortKey = |r| so the strongest
  // relationships float to the top of the grid.
  const scatterChart = (f, rows) => {
    const pts = rows.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
    if (pts.length < 3) return null
    const r = pearson(pts.map((p) => [p.x, p.y]))
    if (r == null) return null
    const reg = linearRegression(pts.map((p) => [p.x, p.y]))
    return {
      factor: f, mode: 'scatter', pts, reg, r, sortKey: Math.abs(r),
      stat: `r${within ? '*' : ''} = ${r >= 0 ? '+' : '−'}${Math.abs(r).toFixed(2)}`
    }
  }

  // A grouped chart's data: y-values bucketed by lens category, plus the D−R gap as the
  // headline. sortKey = |gap| normalized by the overall spread, so factors the party split
  // separates most rise to the top.
  const groupedChart = (f, rows) => {
    const pts = rows.filter((p) => Number.isFinite(p.y) && CAT_COLOR[p.x])
    if (pts.length < 3) return null
    const groups = { R: [], divided: [], D: [] }
    for (const p of pts) groups[p.x].push(p.y)
    const meanR = mean(groups.R)
    const meanD = mean(groups.D)
    const gap = meanR != null && meanD != null ? meanD - meanR : null
    const yAll = pts.map((p) => p.y)
    const [yMin, yMax] = extent(yAll)
    const spread = (yMax - yMin) || 1
    const fmt = f.format ?? String
    return {
      factor: f, mode: 'grouped', pts, groups,
      means: { R: meanR, divided: mean(groups.divided), D: meanD },
      sortKey: gap == null ? -1 : Math.abs(gap) / spread,
      stat: gap == null
        ? `D−R${within ? '*' : ''}: —`
        : `D−R${within ? '*' : ''}: ${gap >= 0 ? '+' : '−'}${fmt(Math.abs(gap))}`
    }
  }

  const render = (charts, grouped, lensColor) => {
    const grid = el.querySelector('.mini-grid')
    if (charts.length === 0) {
      grid.innerHTML = '<p class="corr-empty">Not enough data to chart at this view.</p>'
      return
    }
    grid.innerHTML = ''
    for (const c of charts) {
      const cell = document.createElement('div')
      cell.className = 'mini-chart'
      cell.dataset.factor = c.factor.id
      cell.dataset.mode = c.mode
      cell.innerHTML =
        `<div class="mini-title" title="${c.factor.label}">${c.factor.label}</div>` +
        `<div class="mini-plot"></div>` +
        `<div class="mini-stat">${c.stat}</div>`
      // Click a chart to send that factor to the map.
      cell.querySelector('.mini-title').addEventListener('click', () =>
        store.setState({ factor: c.factor.id })
      )
      grid.appendChild(cell)
      const host = cell.querySelector('.mini-plot')
      if (c.mode === 'scatter') drawScatter(host, c, lensColor)
      else drawGrouped(host, c)
    }
  }

  const drawScatter = (host, c, lensColor) => {
    const svg = select(host).append('svg').attr('class', 'mini-svg')
      .attr('viewBox', `0 0 ${MW} ${MH}`)
    const x = scaleLinear().domain(extent(c.pts, (p) => p.x)).nice().range([PAD, MW - PAD])
    const y = scaleLinear().domain(extent(c.pts, (p) => p.y)).nice().range([MH - PADB, PAD])
    svg.append('line').attr('class', 'mini-axis')
      .attr('x1', PAD).attr('y1', MH - PADB).attr('x2', MW - PAD).attr('y2', MH - PADB)
    if (c.reg) {
      const [x0, x1] = extent(c.pts, (p) => p.x)
      svg.append('line').attr('class', 'mini-fit')
        .attr('x1', x(x0)).attr('y1', y(c.reg.slope * x0 + c.reg.intercept))
        .attr('x2', x(x1)).attr('y2', y(c.reg.slope * x1 + c.reg.intercept))
    }
    svg.selectAll('circle').data(c.pts).enter().append('circle')
      .attr('class', 'mini-dot').attr('r', 2.1)
      .attr('cx', (p) => x(p.x)).attr('cy', (p) => y(p.y))
      .attr('fill', (p) => lensColor(p.xRaw)) // color by the real lens value, not its region deviation
      .append('title').text((p) => p.name)
  }

  const drawGrouped = (host, c) => {
    const svg = select(host).append('svg').attr('class', 'mini-svg')
      .attr('viewBox', `0 0 ${MW} ${MH}`)
    const y = scaleLinear().domain(extent(c.pts, (p) => p.y)).nice().range([MH - PADB, PAD])
    const colX = { R: MW * 0.22, divided: MW * 0.5, D: MW * 0.78 }
    svg.append('line').attr('class', 'mini-axis')
      .attr('x1', PAD).attr('y1', MH - PADB).attr('x2', MW - PAD).attr('y2', MH - PADB)
    for (const cat of CAT_ORDER) {
      const vals = c.groups[cat]
      vals.forEach((v, i) => {
        const jitter = ((i % 7) - 3) * 2.4 // deterministic spread within the column
        svg.append('circle').attr('class', 'mini-dot').attr('r', 2.1)
          .attr('cx', colX[cat] + jitter).attr('cy', y(v)).attr('fill', CAT_COLOR[cat])
      })
      // Group-mean tick, so the R/Div/D difference reads even through the scatter.
      const m = c.means[cat]
      if (m != null) {
        svg.append('line').attr('class', 'mini-mean')
          .attr('x1', colX[cat] - 12).attr('x2', colX[cat] + 12)
          .attr('y1', y(m)).attr('y2', y(m))
      }
      svg.append('text').attr('class', 'mini-cat').attr('x', colX[cat]).attr('y', MH - 1)
        .attr('text-anchor', 'middle').text(CAT_LABEL[cat])
    }
  }

  const renderShell = () => {
    const opts = lensOptions()
      .map((f) => `<option value="${f.id}"${f.id === lens ? ' selected' : ''}>${f.label}</option>`)
      .join('')
    el.innerHTML =
      `<div class="explore"><label class="lens-pick">Lens: ` +
      `<select class="lens-select">${opts}</select></label>` +
      `<label class="within-row"><input type="checkbox" class="within-check"` +
      `${within ? ' checked' : ''}> Within region <span class="within-hint">` +
      `(compare like-with-like; * = region-adjusted)</span></label>` +
      `<p class="explore-note">Each chart plots a factor against the lens, strongest ` +
      `relationship first. Correlation isn’t causation — a raw party gap mostly reflects ` +
      `that blue places are urban. Turn on <em>Within region</em> to strip that out.</p>` +
      `<div class="mini-grid"></div></div>`
    el.querySelector('.lens-select').addEventListener('change', (e) => {
      lens = e.target.value
      lastKey = viewKey()
      compute()
    })
    el.querySelector('.within-check').addEventListener('change', (e) => {
      within = e.target.checked
      compute() // pure re-derivation from cached fetches
    })
  }

  const maybeRecompute = () => {
    const key = viewKey()
    if (key === lastKey) return
    lastKey = key
    compute()
  }

  return {
    id: 'explore',
    label: 'Explore',
    mount(mountEl, s) {
      el = mountEl
      store = s
      renderShell()
      lastKey = viewKey()
      unsub = store.subscribe(maybeRecompute)
      compute()
    },
    unmount() {
      if (unsub) unsub()
      if (el) el.innerHTML = ''
      el = store = unsub = null
      lastKey = null
      reqId = 0
    }
  }
}
