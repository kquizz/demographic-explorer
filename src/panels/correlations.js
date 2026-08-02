import { FACTOR_LIST, FACTORS } from '../data/factors.js'
import { createCensusClient } from '../data/censusClient.js'
import { pearson, describeCorrelation } from '../lib/stats.js'

// Only ramped numeric factors are correlatable, and they all are here: every Census
// factor plus the numeric bundled data layers (BLS unemployment, BLS wages, life
// expectancy). Diverging (elections) and categorical (trifecta) factors carry a `scale`
// and are excluded — a Pearson r against a categorical or signed axis isn't meaningful.
const correlatable = (f) => !!f && !f.scale

// "What correlates with this?" — for the current factor, computes its Pearson r against
// every other correlatable factor over the areas on screen and ranks them by strength.
// Turns the map from "look at one variable" into "discover which variables move together".
export function createCorrelationsPanel({ client = createCensusClient(), geo, sources = {} } = {}) {
  let el = null
  let store = null
  let unsub = null
  let lastKey = null
  let reqId = 0

  const viewKey = () => {
    const s = store.getState()
    return `${s.factor}|${s.geoLevel}|${s.selectedState}|${s.year}`
  }

  // One fetch shape for either kind of factor: Census factors go through the client;
  // bundled numeric layers go through their source (keyed by FIPS and year).
  const fetchRows = (f, s) =>
    f.source
      ? (sources[f.source]?.fetchFactor({
          geoLevel: s.geoLevel, selectedState: s.selectedState, year: s.year
        }) ?? Promise.resolve([]))
      : client.fetchFactor({
          variable: f.variable, variables: f.variables, compute: f.compute,
          dataset: f.dataset, geoLevel: s.geoLevel, year: s.year
        })

  const compute = async () => {
    const s = store.getState()
    const factorA = FACTORS[s.factor]
    if (!correlatable(factorA)) {
      el.innerHTML =
        '<p class="corr-empty">Pick a numeric factor (a Census measure, or a data ' +
        'layer like unemployment, wages or life expectancy) to see what correlates ' +
        'with it across the areas on screen.</p>'
      return
    }
    el.innerHTML = '<p class="corr-loading">Computing correlations…</p>'
    const my = ++reqId

    // Scope every factor to the features actually on screen (a state's counties when
    // drilled in, otherwise the 50 states + DC), so the correlation reflects the current
    // view rather than the whole nation. Census county requests return every US county.
    const ids = geo ? new Set(geo.featureIds(s.geoLevel, s.selectedState)) : null
    const scoped = (rows) => {
      const m = {}
      for (const r of rows) if (!ids || ids.has(r.id)) m[r.id] = r.value
      return m
    }

    const aById = scoped(await fetchRows(factorA, s).catch(() => []))
    const others = FACTOR_LIST.filter((f) => correlatable(f) && f.id !== s.factor)
    const results = await Promise.all(
      others.map(async (f) => {
        const bById = scoped(await fetchRows(f, s).catch(() => []))
        const pairs = Object.keys(aById).map((id) => [aById[id], bById[id]])
        return { id: f.id, label: f.label, r: pearson(pairs) }
      })
    )
    if (my !== reqId) return // a newer factor/geo/year selection superseded this run

    const ranked = results
      .filter((x) => x.r != null)
      .sort((a, b) => Math.abs(b.r) - Math.abs(a.r))
    render(ranked, factorA.label)
  }

  const render = (ranked, aLabel) => {
    if (ranked.length === 0) {
      el.innerHTML = '<p class="corr-empty">Not enough data to correlate at this view.</p>'
      return
    }
    const rows = ranked
      .map((x) => {
        const pct = Math.round(Math.abs(x.r) * 100)
        const dir = x.r >= 0 ? 'pos' : 'neg'
        const sign = x.r >= 0 ? '+' : '−'
        return (
          `<div class="corr-row" title="${describeCorrelation(x.r)}">` +
          `<span class="corr-name">${x.label}</span>` +
          `<span class="corr-bar-wrap"><span class="corr-bar ${dir}" ` +
          `style="width:${pct}%"></span></span>` +
          `<span class="corr-r ${dir}">${sign}${Math.abs(x.r).toFixed(2)}</span></div>`
        )
      })
      .join('')
    el.innerHTML =
      `<div class="corr-head">What correlates with<br><strong>${aLabel}</strong>?</div>` +
      `<div class="corr-list">${rows}</div>`
  }

  const maybeRecompute = () => {
    const key = viewKey()
    if (key === lastKey) return
    lastKey = key
    compute()
  }

  return {
    id: 'correlations',
    label: 'Correlates',
    mount(mountEl, s) {
      el = mountEl
      store = s
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
