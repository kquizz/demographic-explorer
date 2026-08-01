import { describe, it, expect } from 'vitest'
import trifectaData from '../src/data/trifectas.json'
import { trifectaStatus, createTrifectasSource } from '../src/data/trifectasSource.js'

const countBy = (year, status) => trifectaData.years[String(year)][status].length

describe('trifectas.json checksum', () => {
  // Authoritative national trifecta counts (governance year), reconciled against
  // Ballotpedia's own trifecta-change ledger. Every year 2012-2024 is now anchored; the
  // mid-decade years (2012-2016) were verified state-by-state in a Ballotpedia pass — see
  // scripts/build-trifectas.mjs for the provenance and the Virginia tie-break note. If a
  // data edit drifts any count, this test names the year.
  const ANCHORS = [
    { year: 2024, R: 23, D: 17 },
    { year: 2023, R: 22, D: 17 },
    { year: 2022, R: 23, D: 14 },
    { year: 2021, R: 23, D: 15 },
    { year: 2020, R: 21, D: 15 },
    { year: 2019, R: 22, D: 14 },
    { year: 2018, R: 26, D: 8 },
    { year: 2017, R: 26, D: 6 },
    { year: 2016, R: 23, D: 7 },
    { year: 2015, R: 24, D: 7 },
    { year: 2014, R: 24, D: 13 },
    { year: 2013, R: 25, D: 13 },
    { year: 2012, R: 24, D: 11 }
  ]
  for (const { year, R, D } of ANCHORS) {
    it(`${year}: ${R} R / ${D} D`, () => {
      expect(countBy(year, 'R')).toBe(R)
      expect(countBy(year, 'D')).toBe(D)
    })
  }

  it('never lists a state as both R and D in the same year', () => {
    for (const y of Object.values(trifectaData.years)) {
      expect(y.R.filter((f) => y.D.includes(f))).toEqual([])
    }
  })
})

describe('trifectaStatus', () => {
  it('classifies solid-control states', () => {
    expect(trifectaStatus(trifectaData, '48', 2023)).toBe('R') // Texas
    expect(trifectaStatus(trifectaData, '06', 2023)).toBe('D') // California
  })

  it('returns divided for split control', () => {
    expect(trifectaStatus(trifectaData, '42', 2023)).toBe('divided') // Pennsylvania
  })

  it('tracks a flip across years', () => {
    expect(trifectaStatus(trifectaData, '26', 2018)).toBe('R') // Michigan, pre-2022
    expect(trifectaStatus(trifectaData, '26', 2023)).toBe('D') // Michigan, post-2022
  })

  it('counts Virginia as R in 2012-2013 then divided (Ballotpedia tie-break ruling)', () => {
    // VA Senate was 20-20 in 2012-2013; Ballotpedia counts the R Lt. Governor's tie-break
    // as R control, so VA is an R trifecta until McAuliffe (D) took office in 2014.
    expect(trifectaStatus(trifectaData, '51', 2013)).toBe('R')
    expect(trifectaStatus(trifectaData, '51', 2014)).toBe('divided')
    expect(trifectaStatus(trifectaData, '51', 2020)).toBe('D') // Dems swept both chambers
  })

  it('keeps Connecticut D through the 2017-2018 Senate tie (same tie-break rule)', () => {
    // CT Senate was 18-18 in 2017-2018; the D Lt. Governor's tie-break keeps it a D
    // trifecta, so CT is continuously D 2012-2024 with no divided gap. Same rule as VA.
    expect(trifectaStatus(trifectaData, '09', 2016)).toBe('D')
    expect(trifectaStatus(trifectaData, '09', 2017)).toBe('D')
    expect(trifectaStatus(trifectaData, '09', 2018)).toBe('D')
    expect(trifectaStatus(trifectaData, '09', 2019)).toBe('D')
  })

  it('returns null for areas with no state government', () => {
    expect(trifectaStatus(trifectaData, '11', 2023)).toBe(null) // D.C.
  })

  it('clamps years outside the bundled range', () => {
    expect(trifectaStatus(trifectaData, '48', 1990)).toBe(trifectaStatus(trifectaData, '48', 2012))
    expect(trifectaStatus(trifectaData, '48', 2999)).toBe(trifectaStatus(trifectaData, '48', 2024))
  })
})

describe('createTrifectasSource', () => {
  const geo = {
    stateFeatures: () => [{ id: '48' }, { id: '06' }, { id: '42' }, { id: '11' }],
    countyFeatures: (prefix) => [{ id: `${prefix}001` }, { id: `${prefix}003` }]
  }
  const source = createTrifectasSource(trifectaData, geo)

  it('returns a categorical value per state at the nation level', async () => {
    const rows = await source.fetchFactor({ geoLevel: 'nation', year: 2023 })
    const byId = Object.fromEntries(rows.map((r) => [r.id, r.value]))
    expect(byId['48']).toBe('R')
    expect(byId['06']).toBe('D')
    expect(byId['42']).toBe('divided')
    expect(byId['11']).toBe(null)
  })

  it('broadcasts the state status to its counties when drilled in', async () => {
    const rows = await source.fetchFactor({ geoLevel: 'state', selectedState: '48', year: 2023 })
    expect(rows.map((r) => r.id)).toEqual(['48001', '48003'])
    expect(rows.every((r) => r.value === 'R')).toBe(true)
  })
})
