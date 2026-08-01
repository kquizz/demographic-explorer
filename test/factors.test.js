import { describe, it, expect } from 'vitest'
import { FACTORS, FACTOR_LIST } from '../src/data/factors.js'

describe('FACTORS registry', () => {
  it('exposes an ordered list matching the map', () => {
    expect(FACTOR_LIST.length).toBeGreaterThanOrEqual(4)
    for (const f of FACTOR_LIST) expect(FACTORS[f.id]).toBe(f)
  })
  it('gives every factor an id, label, and format function', () => {
    for (const f of FACTOR_LIST) {
      expect(typeof f.id).toBe('string')
      expect(typeof f.label).toBe('string')
      expect(typeof f.format).toBe('function')
    }
  })

  it('gives every Census factor a dataset and a variable or computed variables', () => {
    for (const f of FACTOR_LIST.filter((f) => !f.source)) {
      expect(['acs/acs5', 'acs/acs5/profile']).toContain(f.dataset)
      const single = typeof f.variable === 'string'
      const computed = Array.isArray(f.variables) && typeof f.compute === 'function'
      expect(single || computed).toBe(true)
    }
  })

  it('marks the elections factors with their own source, metric, and diverging scale', () => {
    expect(FACTORS.vote_margin.source).toBe('elections')
    expect(FACTORS.vote_margin.metric).toBe('margin')
    expect(FACTORS.vote_margin.scale).toBe('diverging')
    expect(FACTORS.vote_margin.format(-13.7)).toBe('R+13.7')
    expect(FACTORS.vote_swing.source).toBe('elections')
    expect(FACTORS.vote_swing.metric).toBe('swing')
    expect(FACTORS.vote_swing.scale).toBe('diverging')
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
    // labor force participation and veterans share the same ratio-percent shape
    expect(FACTORS.labor_force_participation.compute([2265008, 3779457])).toBeCloseTo(59.93, 1)
    expect(FACTORS.pct_veterans.compute([398343, 3630798])).toBeCloseTo(10.97, 1)
    // guards against divide-by-zero
    expect(FACTORS.pct_hispanic.compute([50, 0])).toBe(null)
  })

  it('computes mean-style ratio factors as a plain quotient, not a percent (commute)', () => {
    // 46.65M aggregate minutes / 1.94M commuting workers => ~24.1 minutes (NOT *100)
    expect(FACTORS.mean_commute.compute([46654610, 1936854])).toBeCloseTo(24.09, 2)
    expect(FACTORS.mean_commute.compute([100, 0])).toBe(null)
  })

  it('exposes the new single-variable factors on the acs5 detail dataset', () => {
    for (const id of ['rent_burden', 'avg_household_size']) {
      expect(FACTORS[id].dataset).toBe('acs/acs5')
      expect(typeof FACTORS[id].variable).toBe('string')
    }
  })
  it('includes median_income as the default factor', () => {
    expect(FACTORS.median_income).toBeTruthy()
    expect(FACTORS.median_income.format(54943)).toBe('$54,943')
  })
})
