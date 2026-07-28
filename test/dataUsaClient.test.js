import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import states from './fixtures/datausa-states.json'
import { createDataUsaClient } from '../src/data/dataUsaClient.js'

describe('createDataUsaClient', () => {
  let client
  beforeEach(() => {
    client = createDataUsaClient()
    global.fetch = vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve(states) })
    )
  })
  afterEach(() => { vi.restoreAllMocks() })

  it('requests the State drilldown for the nation level', async () => {
    await client.fetchFactor({ measure: 'Household Income', geoLevel: 'nation' })
    const url = global.fetch.mock.calls[0][0]
    expect(url).toContain('drilldowns=State')
    expect(url).toContain('measures=Household%20Income')
  })

  it('normalizes rows to { id, name, value } with FIPS ids', async () => {
    const rows = await client.fetchFactor({ measure: 'Household Income', geoLevel: 'nation' })
    expect(rows).toEqual([
      { id: '01', name: 'Alabama', value: 54943 },
      { id: '02', name: 'Alaska', value: 80287 },
      { id: '04', name: 'Arizona', value: null }
    ])
  })

  it('caches by measure+geoLevel and does not refetch', async () => {
    await client.fetchFactor({ measure: 'Household Income', geoLevel: 'nation' })
    await client.fetchFactor({ measure: 'Household Income', geoLevel: 'nation' })
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it('throws a helpful error on a non-ok response', async () => {
    global.fetch = vi.fn(() => Promise.resolve({ ok: false, status: 500 }))
    await expect(
      client.fetchFactor({ measure: 'Household Income', geoLevel: 'nation' })
    ).rejects.toThrow(/Data USA request failed/)
  })
})
