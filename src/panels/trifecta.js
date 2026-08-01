import { FACTOR_LIST, FACTORS } from '../data/factors.js'
import { createCensusClient } from '../data/censusClient.js'
import { trifectaStatus } from '../data/trifectasSource.js'
import { REGIONS, REGION_OF } from '../data/regions.js'
import { mean, median, weightedMean } from '../lib/stats.js'

// Groups the 50 states by trifecta control and compares a chosen Census factor (poverty
// by default) across Republican / Divided / Democratic groups. This is inherently a
// national, state-grain analysis, so it always pulls all states regardless of the map's
// drill-down. Population-weighting and a within-region breakdown are the guards against
// the geographic confound (red trifectas cluster in the higher-poverty South).

const GROUPS = [
  { key: 'R', label: 'Republican trifecta' },
  { key: 'divided', label: 'Divided' },
  { key: 'D', label: 'Democratic trifecta' }
]
const POPULATION = FACTORS.population // B01003 — the weighting variable

export function createTrifectaPanel({ client = createCensusClient(), trifectaData } = {}) {
  let el = null
  let store = null
  let unsub = null
  let factorId = 'poverty_rate'
  let weighted = true
  let lastYear = null
  // Per-state maps for the loaded year: fips -> factor value, fips -> population.
  let valById = {}
  let popById = {}

  const censusFetch = (f, year) =>
    client.fetchFactor({
      variable: f.variable, variables: f.variables, compute: f.compute,
      dataset: f.dataset, geoLevel: 'nation', year
    })

  // Summary stats for one trifecta group over the states it contains.
  const statsFor = (fipsList) => {
    const vals = fipsList.map((fips) => valById[fips]).filter((v) => v != null)
    const wpairs = fipsList.map((fips) => [valById[fips], popById[fips]])
    return {
      n: vals.length,
      center: weighted ? weightedMean(wpairs) : mean(vals),
      median: median(vals),
      lo: vals.length ? Math.min(...vals) : null,
      hi: vals.length ? Math.max(...vals) : null
    }
  }

  // States (FIPS) in each trifecta group for the given year.
  const groupsFor = (year) => {
    const buckets = { R: [], D: [], divided: [] }
    for (const fips of Object.keys(trifectaData.names)) {
      const status = trifectaStatus(trifectaData, fips, year)
      if (status) buckets[status].push(fips)
    }
    return buckets
  }

  const load = async () => {
    const { year } = store.getState()
    lastYear = year
    const f = FACTORS[factorId]
    const [factorRows, popRows] = await Promise.all([
      censusFetch(f, year),
      censusFetch(POPULATION, year)
    ])
    // A slower earlier response must not overwrite a newer selection.
    if (store.getState().year !== lastYear || FACTORS[factorId] !== f) return
    valById = Object.fromEntries(factorRows.map((r) => [r.id, r.value]))
    popById = Object.fromEntries(popRows.map((r) => [r.id, r.value]))
    renderResults(year)
  }

  const renderResults = (year) => {
    const f = FACTORS[factorId]
    const fmt = f.format
    const buckets = groupsFor(year)
    const stats = Object.fromEntries(GROUPS.map((g) => [g.key, statsFor(buckets[g.key])]))
    const centers = GROUPS.map((g) => stats[g.key].center).filter((v) => v != null)
    const scaleMax = centers.length ? Math.max(...centers) : 1

    const headline = buildHeadline(stats.R, stats.D, f)
    const groupRows = GROUPS.map((g) => {
      const s = stats[g.key]
      const pct = s.center == null ? 0 : Math.max(2, (s.center / scaleMax) * 100)
      return (
        `<div class="tf-group">
           <div class="tf-group-head">
             <span class="tf-dot tf-${g.key}"></span>
             <span class="tf-label">${g.label}</span>
             <span class="tf-n">${s.n} states</span>
           </div>
           <div class="tf-bar-row">
             <div class="tf-bar tf-${g.key}" style="width:${pct}%"></div>
             <span class="tf-center">${fmt(s.center)}</span>
           </div>
           <div class="tf-spread">median ${fmt(s.median)} · range ${fmt(s.lo)}–${fmt(s.hi)}</div>
         </div>`
      )
    }).join('')

    el.querySelector('.tf-results').innerHTML =
      `<div class="tf-headline">${headline}</div>
       ${groupRows}
       ${buildRegionTable(buckets, f)}
       <p class="tf-caveat">
         Red trifectas cluster in the South, which had higher poverty long before current
         control — so a raw gap is geographically confounded. The
         ${weighted ? 'population-weighted means above and the ' : ''}within-region table
         isolate the comparison; read them before the headline.
       </p>`
  }

  const buildHeadline = (r, d, f) => {
    if (r.center == null || d.center == null) return 'Not enough data for a comparison.'
    const gap = r.center - d.center
    const higher = gap > 0 ? 'Republican' : 'Democratic'
    const word = weighted ? 'population-weighted' : 'unweighted'
    return (
      `${higher}-trifecta states average <strong>${f.format(Math.max(r.center, d.center))}</strong> ` +
      `vs <strong>${f.format(Math.min(r.center, d.center))}</strong> in the other — a ` +
      `<strong>${f.format(Math.abs(gap))}</strong> gap (${word}), for ${f.label.toLowerCase()}.`
    )
  }

  // R-vs-D center within each Census region, to defuse the geographic confound.
  const buildRegionTable = (buckets, f) => {
    const inRegion = (fipsList, region) => fipsList.filter((fips) => REGION_OF[fips] === region)
    const centerOf = (fipsList) => {
      if (!fipsList.length) return null
      return weighted
        ? weightedMean(fipsList.map((fips) => [valById[fips], popById[fips]]))
        : mean(fipsList.map((fips) => valById[fips]))
    }
    const rows = Object.keys(REGIONS).map((region) => {
      const rc = centerOf(inRegion(buckets.R, region))
      const dc = centerOf(inRegion(buckets.D, region))
      const gap = rc != null && dc != null ? f.format(rc - dc) : '—'
      return (
        `<tr><td>${region}</td><td>${rc == null ? '—' : f.format(rc)}</td>` +
        `<td>${dc == null ? '—' : f.format(dc)}</td><td>${gap}</td></tr>`
      )
    }).join('')
    return (
      `<div class="tf-region">
         <div class="tf-region-title">Within region (R − D)</div>
         <table class="tf-region-table">
           <thead><tr><th>Region</th><th>R</th><th>D</th><th>R−D</th></tr></thead>
           <tbody>${rows}</tbody>
         </table>
       </div>`
    )
  }

  const renderControls = () => {
    const opts = FACTOR_LIST.filter((f) => !f.source)
      .map((f) => `<option value="${f.id}"${f.id === factorId ? ' selected' : ''}>${f.label}</option>`)
      .join('')
    el.innerHTML =
      `<div class="trifecta-panel">
         <label class="tf-pick-row">Compare
           <select class="tf-pick">${opts}</select>
           across trifecta groups
         </label>
         <label class="tf-weight-row">
           <input type="checkbox" class="tf-weight"${weighted ? ' checked' : ''}>
           Population-weighted
         </label>
         <div class="tf-results"></div>
       </div>`
    el.querySelector('.tf-pick').addEventListener('change', (e) => {
      factorId = e.target.value
      load()
    })
    el.querySelector('.tf-weight').addEventListener('change', (e) => {
      weighted = e.target.checked
      renderResults(store.getState().year) // pure recompute; no refetch
    })
  }

  return {
    id: 'trifecta',
    label: 'Trifecta gap',
    mount(mountEl, s) {
      el = mountEl
      store = s
      renderControls()
      load()
      unsub = store.subscribe(() => {
        if (store.getState().year !== lastYear) load() // year drives the whole analysis
      })
    },
    unmount() {
      if (unsub) unsub()
      if (el) el.innerHTML = ''
      el = store = unsub = null
      valById = {}
      popById = {}
      lastYear = null
    }
  }
}
