import { FACTOR_LIST, FACTORS } from '../data/factors.js'
import { createCensusClient } from '../data/censusClient.js'
import { pearson, describeCorrelation } from '../lib/stats.js'

// "What correlates with this?" — for the current (census) factor, computes its Pearson r
// against every other census factor over the areas on screen and ranks them by strength.
// Turns the map from "look at one variable" into "discover which variables move together".
// Bundled sources (elections, trifecta, LAUS) are excluded: they aren't census-fetchable
// here, and a categorical/diverging factor isn't a meaningful correlation axis.
export function createCorrelationsPanel({ client = createCensusClient() } = {}) {
  let el = null
  let store = null
  let unsub = null
  let lastKey = null
  let reqId = 0

  const viewKey = () => {
    const s = store.getState()
    return `${s.factor}|${s.geoLevel}|${s.selectedState}|${s.year}`
  }

  const fetchArgs = (f, s) => ({
    variable: f.variable, variables: f.variables, compute: f.compute,
    dataset: f.dataset, geoLevel: s.geoLevel, year: s.year
  })

  const compute = async () => {
    const s = store.getState()
    const factorA = FACTORS[s.factor]
    if (!factorA || factorA.source) {
      el.innerHTML =
        '<p class="corr-empty">Pick a Census factor to see what correlates with it ' +
        'across the areas on screen.</p>'
      return
    }
    el.innerHTML = '<p class="corr-loading">Computing correlations…</p>'
    const my = ++reqId

    const aRows = await client.fetchFactor(fetchArgs(factorA, s)).catch(() => [])
    const aById = Object.fromEntries(aRows.map((r) => [r.id, r.value]))
    const others = FACTOR_LIST.filter((f) => !f.source && f.id !== s.factor)
    const results = await Promise.all(
      others.map(async (f) => {
        const rows = await client.fetchFactor(fetchArgs(f, s)).catch(() => [])
        const r = pearson(rows.map((row) => [aById[row.id], row.value]))
        return { id: f.id, label: f.label, r }
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
