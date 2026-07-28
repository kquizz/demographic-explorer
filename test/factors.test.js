import { describe, it, expect } from 'vitest'
import { FACTORS, FACTOR_LIST } from '../src/data/factors.js'

describe('FACTORS registry', () => {
  it('exposes an ordered list matching the map', () => {
    expect(FACTOR_LIST.length).toBeGreaterThanOrEqual(4)
    for (const f of FACTOR_LIST) expect(FACTORS[f.id]).toBe(f)
  })
  it('gives every factor an id, label, Census variable, dataset, and format function', () => {
    for (const f of FACTOR_LIST) {
      expect(typeof f.id).toBe('string')
      expect(typeof f.label).toBe('string')
      expect(typeof f.variable).toBe('string')
      expect(['acs5', 'acs5/profile']).toContain(f.dataset)
      expect(typeof f.format).toBe('function')
    }
  })
  it('includes median_income as the default factor', () => {
    expect(FACTORS.median_income).toBeTruthy()
    expect(FACTORS.median_income.format(54943)).toBe('$54,943')
  })
})
