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

  it('computes bachelor-or-higher as a percentage from the education counts', () => {
    // total=1000, bachelor=100, master=50, professional=25, doctorate=25 => 20%
    expect(FACTORS.bachelors_plus.compute([1000, 100, 50, 25, 25])).toBe(20)
    expect(FACTORS.bachelors_plus.compute([0, 0, 0, 0, 0])).toBe(null)
  })
  it('includes median_income as the default factor', () => {
    expect(FACTORS.median_income).toBeTruthy()
    expect(FACTORS.median_income.format(54943)).toBe('$54,943')
  })
})
