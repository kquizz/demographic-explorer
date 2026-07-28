import { join } from './join.js'
import { extent } from 'd3-array'

export function createDataController(store, client, geo, factors) {
  let currentKey = null

  const load = async (factor, geoLevel, selectedState) => {
    const { variable, dataset } = factors[factor]
    store.setState({
      dataset: { ...store.getState().dataset, status: 'loading', error: null }
    })
    try {
      const rows = await client.fetchFactor({ variable, dataset, geoLevel })
      const featureIds = geo.featureIds(geoLevel, selectedState)
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
      store.setState({
        dataset: { ...store.getState().dataset, status: 'error', error: err.message }
      })
    }
  }

  store.subscribe((state) => {
    if (!state.factor) return
    const key = `${state.factor}|${state.geoLevel}|${state.selectedState}`
    if (key === currentKey) return
    currentKey = key
    load(state.factor, state.geoLevel, state.selectedState)
  })
}
