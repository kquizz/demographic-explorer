import { describe, it, expect, vi } from 'vitest'
import { createStore } from '../src/store/store.js'
import { createDataController } from '../src/data/controller.js'

const geoStub = {
  featureIds: (geoLevel) => (geoLevel === 'nation' ? ['01', '02', '99'] : ['01001'])
}
const factorsStub = {
  median_income: { id: 'median_income', variable: 'B19013_001E', dataset: 'acs/acs5' }
}

const initial = {
  factor: null, geoLevel: 'nation', selectedState: null, year: 2023,
  hoveredId: null, pinnedId: null,
  dataset: { status: 'idle', factor: null, geoLevel: null, rows: [], byId: {}, values: {}, extent: [null, null], error: null }
}

describe('createDataController', () => {
  it('routes elections factors to the elections source with the election year', async () => {
    const factors = { vote_margin: { id: 'vote_margin', source: 'elections' } }
    const census = { fetchFactor: vi.fn() }
    const elections = { fetchFactor: vi.fn(() => Promise.resolve([{ id: '01', name: 'Alabama', value: -50 }])) }
    const store = createStore({ ...initial, electionYear: 2024 })
    createDataController(store, census, geoStub, factors, elections)

    store.setState({ factor: 'vote_margin' })
    await vi.waitFor(() => expect(store.getState().dataset.status).toBe('ready'))

    expect(census.fetchFactor).not.toHaveBeenCalled()
    expect(elections.fetchFactor).toHaveBeenCalledWith(
      expect.objectContaining({ geoLevel: 'nation', electionYear: 2024 })
    )
    expect(store.getState().dataset.byId['01'].value).toBe(-50)
  })

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
    expect(client.fetchFactor).toHaveBeenCalledWith(expect.objectContaining({
      variable: 'B19013_001E', dataset: 'acs/acs5', geoLevel: 'nation', year: 2023
    }))
    expect(ds.values).toEqual({ '01': 59609, '02': 86370, '99': null })
    expect(ds.byId['01']).toEqual({ id: '01', name: 'Alabama', value: 59609 })
    expect(ds.extent).toEqual([59609, 86370])
    expect(ds.factor).toBe('median_income')
  })

  it('scopes rows to the on-screen features (county view drops other states)', async () => {
    // geoStub returns ['01001'] at state level; the API returns counties nationwide.
    const rows = [
      { id: '01001', name: 'Autauga County, Alabama', value: 68315 },
      { id: '48001', name: 'Anderson County, Texas', value: 51000 }
    ]
    const client = { fetchFactor: vi.fn(() => Promise.resolve(rows)) }
    const store = createStore({ ...initial, geoLevel: 'state', selectedState: '01' })
    createDataController(store, client, geoStub, factorsStub)
    store.setState({ factor: 'median_income' })
    await vi.waitFor(() => expect(store.getState().dataset.status).toBe('ready'))
    const ds = store.getState().dataset
    expect(ds.rows).toEqual([{ id: '01001', name: 'Autauga County, Alabama', value: 68315 }])
    expect(ds.byId['48001']).toBeUndefined()
    expect(ds.values).toEqual({ '01001': 68315 })
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

  it('ignores a stale response that resolves after a newer request', async () => {
    // The 2023 request (fired first) resolves LAST; the 2015 request (fired second)
    // resolves first. The final dataset must reflect 2015, not the late 2023 response.
    const deferred = {}
    const makeDeferred = () => { let r; const p = new Promise((res) => { r = res }); return { p, resolve: r } }
    deferred[2023] = makeDeferred()
    deferred[2015] = makeDeferred()
    const client = { fetchFactor: vi.fn(({ year }) => deferred[year].p) }
    const store = createStore(initial)
    createDataController(store, client, geoStub, factorsStub)

    store.setState({ factor: 'median_income' }) // fires the 2023 request
    store.setState({ year: 2015 }) // fires the 2015 request
    // resolve the newer (2015) request first, then the stale (2023) request
    deferred[2015].resolve([{ id: '01', name: 'AL 2015', value: 15 }])
    await vi.waitFor(() => expect(store.getState().dataset.byId['01']?.name).toBe('AL 2015'))
    deferred[2023].resolve([{ id: '01', name: 'AL 2023', value: 23 }])
    await Promise.resolve()
    await Promise.resolve()
    expect(store.getState().dataset.byId['01'].name).toBe('AL 2015') // stale 2023 dropped
  })

  it('refetches for the new year when year changes', async () => {
    const client = { fetchFactor: vi.fn(() => Promise.resolve([])) }
    const store = createStore(initial)
    createDataController(store, client, geoStub, factorsStub)
    store.setState({ factor: 'median_income' })
    await vi.waitFor(() => expect(store.getState().dataset.status).toBe('ready'))
    store.setState({ year: 2015 })
    await vi.waitFor(() => expect(client.fetchFactor).toHaveBeenCalledTimes(2))
    expect(client.fetchFactor.mock.calls[1][0]).toMatchObject({ year: 2015 })
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
