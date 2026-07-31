import { join } from './join.js'
import { extent } from 'd3-array'
import { signed } from '../lib/format.js'

// `elections` is an optional second source (same fetchFactor shape) used by factors
// tagged source: 'elections'; everything else goes through the census `client`.
export function createDataController(store, client, geo, factors, elections = null) {
  let currentKey = null

  // Delta ("change over time") mode: a baseline year is set, differs from the current
  // year, and the factor is a Census factor (elections have their own swing view).
  const isDeltaMode = (factor, state) => {
    const f = factors[factor]
    return (
      f.source !== 'elections' &&
      state.baselineYear != null &&
      state.baselineYear !== state.year
    )
  }

  const censusArgs = (f, geoLevel, year) => ({
    variable: f.variable, variables: f.variables, compute: f.compute,
    dataset: f.dataset, geoLevel, year
  })

  const fetchRows = (factor, state) => {
    const f = factors[factor]
    if (f.source === 'elections') {
      return elections.fetchFactor({
        geoLevel: state.geoLevel, selectedState: state.selectedState,
        electionYear: state.electionYear, metric: f.metric
      })
    }
    return client.fetchFactor(censusArgs(f, state.geoLevel, state.year))
  }

  // Fetch the current and baseline years and return one row per area whose value is the
  // signed change (current − baseline); null where either year is missing.
  const fetchDeltaRows = async (factor, state) => {
    const f = factors[factor]
    const [cur, base] = await Promise.all([
      client.fetchFactor(censusArgs(f, state.geoLevel, state.year)),
      client.fetchFactor(censusArgs(f, state.geoLevel, state.baselineYear))
    ])
    const baseById = Object.fromEntries(base.map((r) => [r.id, r.value]))
    return cur.map((r) => {
      const b = baseById[r.id]
      const value = r.value == null || b == null ? null : r.value - b
      return { id: r.id, name: r.name, value }
    })
  }

  const load = async (key, factor, state) => {
    store.setState({
      dataset: { ...store.getState().dataset, status: 'loading', error: null }
    })
    try {
      const delta = isDeltaMode(factor, state)
      const allRows = delta ? await fetchDeltaRows(factor, state) : await fetchRows(factor, state)
      // Drop stale responses: while this request was in flight the selection may have
      // changed (e.g. the user dragged the year slider), so a slower earlier response
      // must not clobber the current view.
      if (key !== currentKey) return
      const featureIds = geo.featureIds(state.geoLevel, state.selectedState)
      // County sources return every county nationwide; scope rows to the features
      // actually on screen so ranking/details reflect the current view, not the nation.
      const idSet = new Set(featureIds)
      const rows = allRows.filter((r) => idSet.has(r.id))
      const values = join(featureIds, rows)
      const byId = Object.fromEntries(rows.map((r) => [r.id, r]))
      const [min, max] = extent(rows, (r) => r.value)
      // In delta mode the dataset carries its own diverging scale, signed formatter and
      // "Δ label (base→year)" so every consumer renders the change, not the raw factor.
      const f = factors[factor]
      const extras = delta
        ? {
            diverging: true, format: signed(f.format),
            label: `Δ ${f.label} (${state.baselineYear}→${state.year})`
          }
        : { diverging: false, format: null, label: null }
      store.setState({
        dataset: {
          status: 'ready', factor, geoLevel: state.geoLevel, rows, byId, values,
          extent: [min ?? null, max ?? null], error: null, ...extras
        }
      })
    } catch (err) {
      if (key !== currentKey) return
      store.setState({
        dataset: { ...store.getState().dataset, status: 'error', error: err.message }
      })
    }
  }

  store.subscribe((state) => {
    if (!state.factor) return
    // Elections factors vary by election year; Census factors vary by ACS year.
    const isElection = factors[state.factor].source === 'elections'
    const timeKey = isElection ? `E${state.electionYear}` : `Y${state.year}`
    // The baseline only affects the key in delta mode, so toggling it while viewing a
    // factor that ignores it (e.g. elections) doesn't force a needless reload.
    const deltaKey = isDeltaMode(state.factor, state) ? `B${state.baselineYear}` : 'B-'
    const key = `${state.factor}|${state.geoLevel}|${state.selectedState}|${timeKey}|${deltaKey}`
    if (key === currentKey) return
    currentKey = key
    load(key, state.factor, state)
  })
}
