import { describe, it, expect, vi } from 'vitest'
import { createStore } from '../src/store/store.js'
import { createDataController } from '../src/data/controller.js'

const geoStub = {
  featureIds: (geoLevel) => (geoLevel === 'nation' ? ['01', '02', '99'] : ['01001'])
}
const factorsStub = {
  median_income: { id: 'median_income', variable: 'B19013_001E', dataset: 'acs5' }
}

const initial = {
  factor: null, geoLevel: 'nation', selectedState: null,
  hoveredId: null, pinnedId: null,
  dataset: { status: 'idle', factor: null, geoLevel: null, rows: [], byId: {}, values: {}, extent: [null, null], error: null }
}

describe('createDataController', () => {
  it('loads, joins, and writes a ready dataset when factor is set', async () => {
    const rows = [
      { id: '01', name: 'Alabama', value: 59609 },
      { id: '02', name: 'Alaska', value: 86370 }
    ]
    const client = { fetchFactor: vi.fn(() => Promise.resolve(rows)) }
    const store = createStore(initial)
    createDataController(store, client, geoStub, factorsStub)

    store.setState({ factor: 'median_income' })
    await vi.waitFor(() => expect(store.getState().dataset.status).toBe('ready'))

    const ds = store.getState().dataset
    expect(client.fetchFactor).toHaveBeenCalledWith({
      variable: 'B19013_001E', dataset: 'acs5', geoLevel: 'nation'
    })
    expect(ds.values).toEqual({ '01': 59609, '02': 86370, '99': null })
    expect(ds.byId['01']).toEqual({ id: '01', name: 'Alabama', value: 59609 })
    expect(ds.extent).toEqual([59609, 86370])
    expect(ds.factor).toBe('median_income')
  })

  it('does not refetch when only hoveredId changes', async () => {
    const client = { fetchFactor: vi.fn(() => Promise.resolve([])) }
    const store = createStore(initial)
    createDataController(store, client, geoStub, factorsStub)
    store.setState({ factor: 'median_income' })
    await vi.waitFor(() => expect(store.getState().dataset.status).toBe('ready'))
    store.setState({ hoveredId: '01' })
    expect(client.fetchFactor).toHaveBeenCalledTimes(1)
  })

  it('writes an error dataset when the client rejects', async () => {
    const client = { fetchFactor: vi.fn(() => Promise.reject(new Error('boom'))) }
    const store = createStore(initial)
    createDataController(store, client, geoStub, factorsStub)
    store.setState({ factor: 'median_income' })
    await vi.waitFor(() => expect(store.getState().dataset.status).toBe('error'))
    expect(store.getState().dataset.error).toMatch(/boom/)
  })
})
