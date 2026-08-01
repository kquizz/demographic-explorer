import { select } from 'd3-selection'
import { scaleLinear } from 'd3-scale'
import { extent } from 'd3-array'
import { FACTOR_LIST, FACTORS } from '../data/factors.js'
import { createCensusClient } from '../data/censusClient.js'
import { pearson, describeCorrelation } from '../lib/stats.js'

const SW = 280, SH = 220, PAD = 26

export function createComparePanel({ client = createCensusClient() } = {}) {
  let el = null
  let store = null
  let unsub = null
  let factorB = null
  let bValuesById = {}
  let lastKey = null
  let lastHover = null
  let lastPinned = null
  let scatterPoints = {} // id -> { name, x, y } for the on-screen dots, for the hover label

  // Everything that determines the second-factor fetch AND the bivariate coloring.
  const compareKey = () => {
    const s = store.getState()
    return `${factorB}|${s.factor}|${s.geoLevel}|${s.selectedState}|${s.year}`
  }

  const buildTable = () => {
    const { dataset, factor } = store.getState()
    const fmtA = FACTORS[factor].format
    const fmtB = factorB ? FACTORS[factorB].format : String
    const rows = dataset.rows.slice().sort((a, b) => a.name.localeCompare(b.name))
    el.querySelector('.compare-table').innerHTML = rows
      .map((r) => {
        const bVal = bValuesById[r.id]
        return (
          `<div class="compare-row"><span class="name">${r.name}</span>` +
          `<span class="a">${fmtA(r.value)}</span>` +
          `<span class="b">${factorB ? fmtB(bVal == null ? null : bVal) : ''}</span></div>`
        )
      })
      .join('')
  }

  // Scatter of factor A (x) vs factor B (y), one dot per on-screen area, with a Pearson
  // r readout. Dots brush both ways with the map: hovering a dot sets store.hoveredId
  // (highlighting the area), and map hover highlights the matching dot (see hover sub).
  const buildScatter = () => {
    const host = el.querySelector('.compare-scatter')
    if (!host) return
    host.innerHTML = ''
    scatterPoints = {}
    if (!factorB) return
    const { dataset, factor } = store.getState()
    const pts = dataset.rows
      .map((r) => ({ id: String(r.id), name: r.name, x: r.value, y: bValuesById[r.id] }))
      .filter((p) => p.x != null && p.y != null)
    if (pts.length < 2) return
    scatterPoints = Object.fromEntries(pts.map((p) => [p.id, p]))

    // A live readout naming the spotlighted dot's state and its two values.
    host.insertAdjacentHTML('beforeend', '<div class="scatter-label"></div>')

    const r = pearson(pts.map((p) => [p.x, p.y]))
    const x = scaleLinear().domain(extent(pts, (p) => p.x)).nice().range([PAD, SW - PAD])
    const y = scaleLinear().domain(extent(pts, (p) => p.y)).nice().range([SH - PAD, PAD])

    const svg = select(host).append('svg')
      .attr('class', 'scatter-svg').attr('viewBox', `0 0 ${SW} ${SH}`)
    svg.append('rect').attr('class', 'frame')
      .attr('x', PAD).attr('y', PAD).attr('width', SW - 2 * PAD).attr('height', SH - 2 * PAD)
    svg.append('text').attr('class', 'axis-label x-label')
      .attr('x', SW / 2).attr('y', SH - 4).attr('text-anchor', 'middle')
      .text(FACTORS[factor].label)
    svg.append('text').attr('class', 'axis-label y-label')
      .attr('transform', `translate(9 ${SH / 2}) rotate(-90)`).attr('text-anchor', 'middle')
      .text(FACTORS[factorB].label)

    svg.selectAll('circle.dot').data(pts, (p) => p.id).enter().append('circle')
      .attr('class', 'dot').attr('data-id', (p) => p.id).attr('r', 3.5)
      .attr('cx', (p) => x(p.x)).attr('cy', (p) => y(p.y))
      .append('title').text((p) => p.name)
    svg.selectAll('circle.dot')
      .on('pointerover', (_e, p) => store.setState({ hoveredId: p.id }))
      .on('pointerout', () => store.setState({ hoveredId: null }))
      .on('click', (_e, p) => store.setState({ pinnedId: p.id })) // click a dot to pin its state

    const strength = describeCorrelation(r)
    host.insertAdjacentHTML('beforeend',
      `<div class="r-readout">r = ${r == null ? '—' : r.toFixed(2)} ` +
      `<span class="r-strength">(${strength})</span></div>`)
    highlightHover()
  }

  // The area the scatter is currently spotlighting: a pinned dot wins over a hovered one,
  // matching the details panel so the whole UI points at the same place.
  const activeId = () => {
    const s = store.getState()
    return s.pinnedId ?? s.hoveredId
  }

  // The name + both values of the spotlighted dot, or a hint when nothing is picked.
  const labelHtml = (id) => {
    const p = id ? scatterPoints[id] : null
    if (!p) return '<span class="sl-hint">Hover or click a point to see its state</span>'
    const { factor } = store.getState()
    const fmtA = FACTORS[factor].format ?? String
    const fmtB = factorB ? FACTORS[factorB].format ?? String : String
    return `<span class="sl-name">${p.name}</span> · ${fmtA(p.x)} / ${fmtB(p.y)}`
  }

  // Cheap re-highlight — re-class the dots and refresh the name label, no rebuild.
  const highlightHover = () => {
    const host = el && el.querySelector('.compare-scatter')
    if (!host) return
    const id = activeId()
    host.querySelectorAll('circle.dot').forEach((c) => {
      const on = c.getAttribute('data-id') === id
      c.classList.toggle('hi', on)
      if (on) c.parentNode.appendChild(c) // raise to front
    })
    const label = host.querySelector('.scatter-label')
    if (label) label.innerHTML = labelHtml(id)
  }

  // Fetch factor B (if chosen) and publish it to the store so the map colors bivariately.
  const loadAndPublish = async () => {
    if (!factorB) {
      bValuesById = {}
      store.setState({ compare: null })
      buildTable()
      buildScatter()
      return
    }
    const { variable, variables, compute, dataset } = FACTORS[factorB]
    const { geoLevel, year } = store.getState()
    const rows = await client.fetchFactor({ variable, variables, compute, dataset, geoLevel, year })
    bValuesById = Object.fromEntries(rows.map((r) => [r.id, r.value]))
    store.setState({ compare: { factor: factorB, valuesById: bValuesById } })
    buildTable()
    buildScatter()
  }

  const renderPicker = () => {
    const { factor } = store.getState()
    // Factor B can't be factor A; if A just became what B was, drop B.
    if (factorB === factor) factorB = null
    // Factor B is fetched through the census client, so only census factors can be a
    // comparison axis — bundled sources (elections, trifectas, LAUS) have no census
    // variable/dataset to fetch and are excluded from the picker.
    const opts = FACTOR_LIST.filter((f) => f.id !== factor && !f.source)
      .map((f) => `<option value="${f.id}"${f.id === factorB ? ' selected' : ''}>${f.label}</option>`)
      .join('')
    el.innerHTML =
      `<div class="compare"><label>Compare with:` +
      `<select class="compare-pick"><option value="">— pick a factor —</option>${opts}</select>` +
      `</label><div class="compare-scatter"></div><div class="compare-table"></div></div>`
    el.querySelector('.compare-pick').addEventListener('change', (e) => {
      factorB = e.target.value || null
      lastKey = compareKey()
      loadAndPublish()
    })
  }

  return {
    id: 'compare',
    label: 'Compare',
    mount(mountEl, s) {
      el = mountEl
      store = s
      renderPicker()
      lastKey = compareKey()
      lastHover = store.getState().hoveredId
      lastPinned = store.getState().pinnedId
      unsub = store.subscribe(() => {
        const st = store.getState()
        // Hover/pin are cheap: just re-highlight the matching dot, never rebuild.
        if (st.hoveredId !== lastHover || st.pinnedId !== lastPinned) {
          lastHover = st.hoveredId
          lastPinned = st.pinnedId
          highlightHover()
        }
        // React to compare inputs (factor A / geo / year) — not to our own `compare`
        // write (which leaves the key unchanged).
        const key = compareKey()
        if (key === lastKey) return
        lastKey = key
        renderPicker()
        loadAndPublish()
      })
    },
    unmount() {
      if (unsub) unsub()
      if (store) store.setState({ compare: null }) // revert the map to a single factor
      if (el) el.innerHTML = ''
      el = store = unsub = null
      factorB = null
      bValuesById = {}
      lastKey = null
      lastHover = null
      lastPinned = null
      scatterPoints = {}
    }
  }
}
