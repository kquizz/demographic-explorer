import { describe, it, expect } from 'vitest'
import wageData from '../src/data/wages.json'
import { createFipsYearSource } from '../src/data/fipsYearSource.js'

describe('wages.json bundle', () => {
  it('covers 2014-2023 (QCEW starts in 2014)', () => {
    expect(wageData.firstYear).toBe(2014)
    expect(wageData.lastYear).toBe(2023)
  })

  it('carries states and counties with plausible pay in dollars', () => {
    const keys = Object.keys(wageData.years['2023'])
    expect(keys.filter((k) => k.length === 2).length).toBeGreaterThanOrEqual(50)
    expect(keys.filter((k) => k.length === 5).length).toBeGreaterThan(3000)
    // California average annual pay in 2023 is well above $40k
    expect(wageData.years['2023']['06']).toBeGreaterThan(40000)
    for (const bucket of Object.values(wageData.years)) {
      for (const v of Object.values(bucket)) {
        expect(typeof v).toBe('number')
        expect(v).toBeGreaterThan(0)
      }
    }
  })
})

describe('wages source', () => {
  const source = createFipsYearSource(wageData)

  it('serves states at the nation level and counties when drilled in', async () => {
    const nation = await source.fetchFactor({ geoLevel: 'nation', year: 2023 })
    expect(nation.every((r) => r.id.length === 2)).toBe(true)
    const counties = await source.fetchFactor({ geoLevel: 'state', selectedState: '06', year: 2023 })
    expect(counties.length).toBeGreaterThan(50)
    expect(counties.every((r) => r.id.length === 5 && r.id.startsWith('06'))).toBe(true)
  })

  it('has no data before 2014, where the slider still reaches', async () => {
    expect(await source.fetchFactor({ geoLevel: 'nation', year: 2012 })).toEqual([])
  })
})
