import { describe, it, expect } from 'vitest'
import healthData from '../src/data/health.json'
import { createFipsYearSource } from '../src/data/fipsYearSource.js'

describe('health.json bundle', () => {
  it('covers 2019-2023 (CHR life expectancy releases)', () => {
    expect(healthData.firstYear).toBe(2019)
    expect(healthData.lastYear).toBe(2023)
  })

  it('carries states and counties with plausible life expectancy in years', () => {
    const keys = Object.keys(healthData.years['2023'])
    expect(keys.filter((k) => k.length === 2).length).toBeGreaterThanOrEqual(50)
    expect(keys.filter((k) => k.length === 5).length).toBeGreaterThan(3000)
    for (const bucket of Object.values(healthData.years)) {
      for (const v of Object.values(bucket)) {
        expect(typeof v).toBe('number')
        expect(v).toBeGreaterThan(50) // no US county lives under ~60 or over ~100 years
        expect(v).toBeLessThan(100)
      }
    }
  })
})

describe('health source', () => {
  const source = createFipsYearSource(healthData)

  it('serves states at the nation level and counties when drilled in', async () => {
    const nation = await source.fetchFactor({ geoLevel: 'nation', year: 2023 })
    expect(nation.every((r) => r.id.length === 2)).toBe(true)
    const counties = await source.fetchFactor({ geoLevel: 'state', selectedState: '06', year: 2023 })
    expect(counties.length).toBeGreaterThan(30)
    expect(counties.every((r) => r.id.length === 5 && r.id.startsWith('06'))).toBe(true)
  })

  it('has no data before 2019', async () => {
    expect(await source.fetchFactor({ geoLevel: 'nation', year: 2015 })).toEqual([])
  })
})
