import { describe, it, expect } from 'vitest'
import { mean, median, weightedMean } from '../src/lib/stats.js'

describe('mean', () => {
  it('averages finite values and ignores nulls', () => {
    expect(mean([2, 4, null, 6])).toBe(4)
  })
  it('returns null with no usable values', () => {
    expect(mean([null, NaN])).toBe(null)
  })
})

describe('median', () => {
  it('handles odd and even counts', () => {
    expect(median([3, 1, 2])).toBe(2)
    expect(median([1, 2, 3, 4])).toBe(2.5)
  })
  it('drops nulls before ordering', () => {
    expect(median([10, null, 2, 6])).toBe(6)
  })
})

describe('weightedMean', () => {
  it('weights values by their weight', () => {
    // (10*1 + 20*3) / (1+3) = 70/4 = 17.5
    expect(weightedMean([[10, 1], [20, 3]])).toBe(17.5)
  })
  it('drops pairs with null value or non-positive weight', () => {
    expect(weightedMean([[10, 1], [999, 0], [null, 5]])).toBe(10)
  })
  it('returns null when no weight remains', () => {
    expect(weightedMean([[10, 0], [20, null]])).toBe(null)
  })
})
