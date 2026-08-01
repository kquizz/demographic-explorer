import { describe, it, expect } from 'vitest'
import lausData from '../src/data/laus.json'
import { createLausSource } from '../src/data/lausSource.js'

describe('laus.json bundle', () => {
  it('spans the ACS slider years', () => {
    expect(lausData.firstYear).toBe(2012)
    expect(lausData.lastYear).toBe(2023)
    for (let y = 2012; y <= 2023; y++) {
      expect(lausData.years[String(y)]).toBeTypeOf('object')
    }
  })

  it('carries states (2-digit) and counties (5-digit) keyed by FIPS', () => {
    const keys = Object.keys(lausData.years['2023'])
    expect(keys.filter((k) => k.length === 2).length).toBeGreaterThanOrEqual(50)
    expect(keys.filter((k) => k.length === 5).length).toBeGreaterThan(3000)
  })

  it('holds plausible unemployment rates as numbers', () => {
    for (const bucket of Object.values(lausData.years)) {
      for (const v of Object.values(bucket)) {
        expect(typeof v).toBe('number')
        expect(v).toBeGreaterThanOrEqual(0)
        expect(v).toBeLessThan(40)
      }
    }
  })

  it('reflects the national 2020 COVID spike (California, the anchor value)', () => {
    // CA annual-average rose from 4.1% (2019) to 10.1% (2020) — a fixed check that the
    // right series landed under the right FIPS/year.
    expect(lausData.years['2019']['06']).toBeCloseTo(4.1, 1)
    expect(lausData.years['2020']['06']).toBeCloseTo(10.1, 1)
    expect(lausData.years['2020']['06']).toBeGreaterThan(lausData.years['2019']['06'])
  })

  it('names states and counties for the details panel', () => {
    expect(lausData.names['06']).toBe('California')
    expect(lausData.names['01001']).toContain('Alabama')
  })
})

describe('createLausSource', () => {
  const source = createLausSource(lausData)

  it('returns one row per state at the nation level', async () => {
    const rows = await source.fetchFactor({ geoLevel: 'nation', year: 2023 })
    expect(rows.every((r) => r.id.length === 2)).toBe(true)
    const ca = rows.find((r) => r.id === '06')
    expect(ca.name).toBe('California')
    expect(ca.value).toBeTypeOf('number')
  })

  it('returns the selected state\'s counties when drilled in', async () => {
    const rows = await source.fetchFactor({ geoLevel: 'state', selectedState: '06', year: 2023 })
    expect(rows.length).toBeGreaterThan(50) // California has 58 counties
    expect(rows.every((r) => r.id.length === 5 && r.id.startsWith('06'))).toBe(true)
  })

  it('clamps years outside the bundled range to the nearest available year', async () => {
    const [below] = await source.fetchFactor({ geoLevel: 'nation', year: 1990 })
    const [first] = await source.fetchFactor({ geoLevel: 'nation', year: 2012 })
    expect(below.value).toBe(first.value)
    const [above] = await source.fetchFactor({ geoLevel: 'nation', year: 2999 })
    const [last] = await source.fetchFactor({ geoLevel: 'nation', year: 2023 })
    expect(above.value).toBe(last.value)
  })
})
