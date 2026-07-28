import { join } from './join.js'
import { extent } from 'd3-array'

export function createDataController(store, client, geo, factors) {
  let currentKey = null

  const load = async (key, factor, geoLevel, selectedState, year) => {
    const { variable, variables, compute, dataset } = factors[factor]
    store.setState({
      dataset: { ...store.getState().dataset, status: 'loading', error: null }
    })
    try {
      const allRows = await client.fetchFactor({
        variable, variables, compute, dataset, geoLevel, year
      })
      // Drop stale responses: while this request was in flight the selection may have
      // changed (e.g. the user dragged the year slider), so a slower earlier response
      // must not clobber the current view.
      if (key !== currentKey) return
      const featureIds = geo.featureIds(geoLevel, selectedState)
      // The county API returns every county nationwide; scope rows to the features
      // actually on screen so ranking/details reflect the current view, not the nation.
      const idSet = new Set(featureIds)
      const rows = allRows.filter((r) => idSet.has(r.id))
      const values = join(featureIds, rows)
      const byId = Object.fromEntries(rows.map((r) => [r.id, r]))
      const [min, max] = extent(rows, (r) => r.value)
      store.setState({
        dataset: {
          status: 'ready', factor, geoLevel, rows, byId, values,
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
    const key = `${state.factor}|${state.geoLevel}|${state.selectedState}|${state.year}`
    if (key === currentKey) return
    currentKey = key
    load(key, state.factor, state.geoLevel, state.selectedState, state.year)
  })
}
