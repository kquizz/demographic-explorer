import { describe, it, expect } from 'vitest'
import { pearson, describeCorrelation, linearRegression } from '../src/lib/stats.js'

describe('pearson', () => {
  it('returns 1 for a perfect positive line', () => {
    expect(pearson([[1, 2], [2, 4], [3, 6]])).toBeCloseTo(1, 10)
  })
  it('returns -1 for a perfect negative line', () => {
    expect(pearson([[1, 6], [2, 4], [3, 2]])).toBeCloseTo(-1, 10)
  })
  it('returns near 0 for uncorrelated data', () => {
    const r = pearson([[1, 5], [2, 1], [3, 6], [4, 2]])
    expect(Math.abs(r)).toBeLessThan(0.5)
  })
  it('drops pairs with a null component before computing', () => {
    expect(pearson([[1, 2], [2, 4], [3, null], [null, 8]])).toBeCloseTo(1, 10)
  })
  it('returns null with fewer than two usable pairs', () => {
    expect(pearson([[1, 2]])).toBe(null)
    expect(pearson([[1, null], [null, 2]])).toBe(null)
  })
  it('returns null when a variable has zero variance', () => {
    expect(pearson([[5, 1], [5, 2], [5, 3]])).toBe(null)
  })
})

describe('linearRegression', () => {
  it('recovers the slope and intercept of a clean line', () => {
    // y = 2x + 1
    const fit = linearRegression([[0, 1], [1, 3], [2, 5], [3, 7]])
    expect(fit.slope).toBeCloseTo(2, 6)
    expect(fit.intercept).toBeCloseTo(1, 6)
  })

  it('drops null pairs and returns null when x has no variance', () => {
    expect(linearRegression([[5, 1], [5, 2], [5, 3]])).toBe(null)
    expect(linearRegression([[1, 1], [null, 2]])).toBe(null) // one usable pair
  })
})

describe('describeCorrelation', () => {
  it('labels strength and sign', () => {
    expect(describeCorrelation(0.9)).toBe('very strong positive')
    expect(describeCorrelation(-0.65)).toBe('strong negative')
    expect(describeCorrelation(0.3)).toBe('weak positive')
  })
  it('reports no correlation near zero and handles null', () => {
    expect(describeCorrelation(0.01)).toBe('no correlation')
    expect(describeCorrelation(null)).toBe('not enough data')
  })
})
