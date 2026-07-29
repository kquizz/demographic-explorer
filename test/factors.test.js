import { describe, it, expect } from 'vitest'
import { FACTORS, FACTOR_LIST } from '../src/data/factors.js'

describe('FACTORS registry', () => {
  it('exposes an ordered list matching the map', () => {
    expect(FACTOR_LIST.length).toBeGreaterThanOrEqual(4)
    for (const f of FACTOR_LIST) expect(FACTORS[f.id]).toBe(f)
  })
  it('gives every factor an id, label, dataset, format, and a variable or computed variables', () => {
    for (const f of FACTOR_LIST) {
      expect(typeof f.id).toBe('string')
      expect(typeof f.label).toBe('string')
      expect(['acs/acs5', 'acs/acs5/profile']).toContain(f.dataset)
      expect(typeof f.format).toBe('function')
      const single = typeof f.variable === 'string'
      const computed = Array.isArray(f.variables) && typeof f.compute === 'function'
      expect(single || computed).toBe(true)
    }
  })

  it('computes share-shaped factors as sum(parts)/total (education attainment)', () => {
    // total=1000, bachelor=100, master=50, professional=25, doctorate=25 => 20%
    expect(FACTORS.bachelors_plus.compute([1000, 100, 50, 25, 25])).toBe(20)
    expect(FACTORS.bachelors_plus.compute([0, 0, 0, 0, 0])).toBe(null)
    // hs_plus sums all nine attainment buckets over the total
    expect(FACTORS.hs_plus.compute([1000, 100, 100, 100, 100, 100, 100, 100, 100, 100])).toBe(90)
  })

  it('computes ratio-shaped factors as numerator/denominator (unemployment, race)', () => {
    // unemployment: 500 unemployed / 10000 labor force => 5%
    expect(FACTORS.unemployment_rate.compute([500, 10000])).toBe(5)
    // homeownership: 700 owner-occupied / 1000 occupied => 70%
    expect(FACTORS.homeownership_rate.compute([700, 1000])).toBe(70)
    // guards against divide-by-zero
    expect(FACTORS.pct_hispanic.compute([50, 0])).toBe(null)
  })
  it('includes median_income as the default factor', () => {
    expect(FACTORS.median_income).toBeTruthy()
    expect(FACTORS.median_income.format(54943)).toBe('$54,943')
  })
})
