import { describe, it, expect } from 'vitest'
import rppData from '../src/data/rpp.json'
import { createFipsYearSource } from '../src/data/fipsYearSource.js'

const COMPONENTS = ['all', 'goods', 'housing', 'utilities', 'services']

describe('rpp.json bundle (BEA Regional Price Parities)', () => {
  it('carries all five cost-of-living components', () => {
    for (const c of COMPONENTS) expect(rppData[c]).toBeTruthy()
  })

  it('covers the ACS slider range with plausible index values (US = 100)', () => {
    for (const c of COMPONENTS) {
      const bundle = rppData[c]
      expect(bundle.firstYear).toBeLessThanOrEqual(2012)
      expect(bundle.lastYear).toBeGreaterThanOrEqual(2023)
      const states = Object.keys(bundle.years['2023'])
      expect(states.length).toBeGreaterThanOrEqual(50)
      for (const v of Object.values(bundle.years['2023'])) {
        expect(typeof v).toBe('number')
        expect(v).toBeGreaterThan(45) // low-cost states' utilities dip into the 50s
        expect(v).toBeLessThan(200) // DC/HI housing are the high extremes
      }
    }
  })

  it('is state-keyed: serves states at the nation level, nothing at county level', async () => {
    const source = createFipsYearSource(rppData.all)
    const nation = await source.fetchFactor({ geoLevel: 'nation', year: 2023 })
    expect(nation.length).toBeGreaterThanOrEqual(50)
    expect(nation.every((r) => r.id.length === 2)).toBe(true)
    const counties = await source.fetchFactor({ geoLevel: 'state', selectedState: '06', year: 2023 })
    expect(counties).toEqual([]) // RPP has no county data
  })

  it('reflects known cost differences (CA housing far above the US average)', () => {
    expect(rppData.housing.years['2023']['06']).toBeGreaterThan(120) // California
    expect(rppData.all.years['2023']['06']).toBeGreaterThan(105)
  })
})
