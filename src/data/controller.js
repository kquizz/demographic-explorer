import { join } from './join.js'
import { extent } from 'd3-array'

// `elections` is an optional second source (same fetchFactor shape) used by factors
// tagged source: 'elections'; everything else goes through the census `client`.
export function createDataController(store, client, geo, factors, elections = null) {
  let currentKey = null

  const fetchRows = (factor, state) => {
    const f = factors[factor]
    if (f.source === 'elections') {
      return elections.fetchFactor({
        geoLevel: state.geoLevel, selectedState: state.selectedState, electionYear: state.electionYear
      })
    }
    return client.fetchFactor({
      variable: f.variable, variables: f.variables, compute: f.compute,
      dataset: f.dataset, geoLevel: state.geoLevel, year: state.year
    })
  }

  const load = async (key, factor, state) => {
    store.setState({
      dataset: { ...store.getState().dataset, status: 'loading', error: null }
    })
    try {
      const allRows = await fetchRows(factor, state)
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
      store.setState({
        dataset: {
          status: 'ready', factor, geoLevel: state.geoLevel, rows, byId, values,
          extent: [min ?? null, max ?? null], error: null
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
    const key = `${state.factor}|${state.geoLevel}|${state.selectedState}|${timeKey}`
    if (key === currentKey) return
    currentKey = key
    load(key, state.factor, state)
  })
}
