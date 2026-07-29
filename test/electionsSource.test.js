import { describe, it, expect } from 'vitest'
import { createElectionsSource } from '../src/data/electionsSource.js'

const data = {
  2024: {
    '01': { n: 'Alabama', d: 100, r: 300, t: 400 },       // state agg (R+50)
    '06': { n: 'California', d: 60, r: 40, t: 100 },        // state agg (D+20)
    '01001': { n: 'Autauga County', d: 25, r: 75, t: 100 }, // county in AL
    '06001': { n: 'Alameda County', d: 80, r: 20, t: 100 }, // county in CA
    '72': { n: 'Puerto Rico', d: 0, r: 0, t: 0 }            // no vote -> null
  }
}

describe('createElectionsSource', () => {
  const src = createElectionsSource(data)

  it('returns state-level margin rows at the nation level', async () => {
    const rows = await src.fetchFactor({ geoLevel: 'nation', selectedState: null, electionYear: 2024 })
    const byId = Object.fromEntries(rows.map((r) => [r.id, r]))
    expect(byId['01']).toEqual({ id: '01', name: 'Alabama', value: -50 })
    expect(byId['06']).toEqual({ id: '06', name: 'California', value: 20 })
    expect(byId['01001']).toBeUndefined() // counties excluded at nation level
  })

  it('returns the selected state\'s county margins at the state level', async () => {
    const rows = await src.fetchFactor({ geoLevel: 'state', selectedState: '01', electionYear: 2024 })
    expect(rows).toEqual([{ id: '01001', name: 'Autauga County', value: -50 }])
  })

  it('yields null margin where there are no votes', async () => {
    const rows = await src.fetchFactor({ geoLevel: 'nation', selectedState: null, electionYear: 2024 })
    expect(rows.find((r) => r.id === '72').value).toBe(null)
  })
})
