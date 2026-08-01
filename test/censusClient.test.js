import { describe, it, expect, vi, afterEach } from 'vitest'
import { createCensusClient } from '../src/data/censusClient.js'

const stateTable = [
  ['NAME', 'B19013_001E', 'state'],
  ['Alabama', '59609', '01'],
  ['Alaska', '86370', '02'],
  ['Puerto Rico', '-666666666', '72'] // negative sentinel => null
]

const countyTable = [
  ['NAME', 'B19013_001E', 'state', 'county'],
  ['Autauga County, Alabama', '68315', '01', '001'],
  ['Baldwin County, Alabama', '67560', '01', '003']
]

const mockFetch = (table) =>
  vi.fn(() => Promise.resolve({ ok: true, text: () => Promise.resolve(JSON.stringify(table)) }))

describe('createCensusClient', () => {
  afterEach(() => vi.restoreAllMocks())

  it('requests the acs5 dataset with NAME + variable for states', async () => {
    global.fetch = mockFetch(stateTable)
    const client = createCensusClient({ key: 'k', year: 2022 })
    await client.fetchFactor({ variable: 'B19013_001E', dataset: 'acs/acs5', geoLevel: 'nation' })
    const url = global.fetch.mock.calls[0][0]
    expect(url).toContain('/2022/acs/acs5?')
    expect(url).toContain('get=NAME%2CB19013_001E')
    expect(url).toContain('for=state')
    expect(url).toContain('key=k')
  })

  it('normalizes state rows to { id, name, value } with 2-digit FIPS', async () => {
    global.fetch = mockFetch(stateTable)
    const client = createCensusClient({ key: 'k' })
    const rows = await client.fetchFactor({ variable: 'B19013_001E', dataset: 'acs/acs5', geoLevel: 'nation' })
    expect(rows).toEqual([
      { id: '01', name: 'Alabama', value: 59609 },
      { id: '02', name: 'Alaska', value: 86370 },
      { id: '72', name: 'Puerto Rico', value: null }
    ])
  })

  it('builds 5-digit county FIPS from state+county columns', async () => {
    global.fetch = mockFetch(countyTable)
    const client = createCensusClient({ key: 'k' })
    const rows = await client.fetchFactor({ variable: 'B19013_001E', dataset: 'acs/acs5', geoLevel: 'state' })
    expect(rows[0]).toEqual({ id: '01001', name: 'Autauga County, Alabama', value: 68315 })
  })

  it('uses the profile dataset path when specified', async () => {
    global.fetch = mockFetch(stateTable)
    const client = createCensusClient({ key: 'k', year: 2022 })
    await client.fetchFactor({ variable: 'DP03_0128PE', dataset: 'acs/acs5/profile', geoLevel: 'nation' })
    expect(global.fetch.mock.calls[0][0]).toContain('/2022/acs/acs5/profile?')
  })

  it('caches by dataset + variable + geoLevel', async () => {
    global.fetch = mockFetch(stateTable)
    const client = createCensusClient({ key: 'k' })
    await client.fetchFactor({ variable: 'B19013_001E', dataset: 'acs/acs5', geoLevel: 'nation' })
    await client.fetchFactor({ variable: 'B19013_001E', dataset: 'acs/acs5', geoLevel: 'nation' })
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it('throws a clear error when the body is not JSON (invalid-key page)', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({ ok: true, text: () => Promise.resolve('<html>Invalid Key</html>') })
    )
    const client = createCensusClient({ key: 'bad' })
    await expect(
      client.fetchFactor({ variable: 'B19013_001E', dataset: 'acs/acs5', geoLevel: 'nation' })
    ).rejects.toThrow(/non-JSON/)
  })

  it('throws on a non-ok response', async () => {
    global.fetch = vi.fn(() => Promise.resolve({ ok: false, status: 500 }))
    const client = createCensusClient({ key: 'k' })
    await expect(
      client.fetchFactor({ variable: 'B19013_001E', dataset: 'acs/acs5', geoLevel: 'nation' })
    ).rejects.toThrow(/Census request failed/)
  })

  it('requests the given year and includes it in the cache key', async () => {
    global.fetch = mockFetch(stateTable)
    const client = createCensusClient({ key: 'k', year: 2023 })
    await client.fetchFactor({ variable: 'B19013_001E', dataset: 'acs/acs5', geoLevel: 'nation', year: 2015 })
    await client.fetchFactor({ variable: 'B19013_001E', dataset: 'acs/acs5', geoLevel: 'nation', year: 2020 })
    expect(global.fetch.mock.calls[0][0]).toContain('/2015/acs/acs5?')
    expect(global.fetch.mock.calls[1][0]).toContain('/2020/acs/acs5?')
    expect(global.fetch).toHaveBeenCalledTimes(2) // different years are not shared cache entries
  })

  it('shares one in-flight request between concurrent identical calls', async () => {
    let release
    global.fetch = vi.fn(
      () =>
        new Promise((resolve) => {
          release = () => resolve({ ok: true, text: () => Promise.resolve(JSON.stringify(stateTable)) })
        })
    )
    const client = createCensusClient({ key: 'k' })
    const args = { variable: 'B19013_001E', dataset: 'acs/acs5', geoLevel: 'nation' }
    const p1 = client.fetchFactor(args)
    const p2 = client.fetchFactor(args) // fired before the first resolves
    release()
    await Promise.all([p1, p2])
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it('evicts a failed request so a later call retries instead of caching the failure', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve(JSON.stringify(stateTable)) })
    const client = createCensusClient({ key: 'k' })
    const args = { variable: 'B19013_001E', dataset: 'acs/acs5', geoLevel: 'nation' }
    await expect(client.fetchFactor(args)).rejects.toThrow(/Census request failed/)
    const rows = await client.fetchFactor(args)
    expect(rows[0].id).toBe('01')
    expect(global.fetch).toHaveBeenCalledTimes(2)
  })

  it('requests multiple variables and derives the value via compute', async () => {
    const eduTable = [
      ['NAME', 'B15003_001E', 'B15003_022E', 'B15003_023E', 'state'],
      ['Alabama', '3000000', '600000', '150000', '01']
    ]
    global.fetch = mockFetch(eduTable)
    const client = createCensusClient({ key: 'k' })
    const rows = await client.fetchFactor({
      variables: ['B15003_001E', 'B15003_022E', 'B15003_023E'],
      dataset: 'acs/acs5',
      geoLevel: 'nation',
      compute: (v) => (v[0] ? ((v[1] + v[2]) / v[0]) * 100 : null)
    })
    expect(global.fetch.mock.calls[0][0]).toContain('get=NAME%2CB15003_001E%2CB15003_022E%2CB15003_023E')
    expect(rows[0]).toEqual({ id: '01', name: 'Alabama', value: 25 })
  })
})
