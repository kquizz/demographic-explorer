import { describe, it, expect } from 'vitest'
import { tercileThresholds, binOf, bivariateColor, BIVARIATE_PALETTE } from '../src/map/bivariate.js'

describe('bivariate helpers', () => {
  it('computes tercile thresholds from non-null values', () => {
    expect(tercileThresholds([1, 2, 3, 4, 5, 6, 7, 8, 9])).toEqual([3, 6])
  })

  it('ignores nulls and returns null when there are no values', () => {
    expect(tercileThresholds([null, null])).toBe(null)
  })

  it('bins values into low/mid/high by threshold', () => {
    const t = [3, 6]
    expect(binOf(1, t)).toBe(0)
    expect(binOf(3, t)).toBe(1)
    expect(binOf(5, t)).toBe(1)
    expect(binOf(6, t)).toBe(2)
    expect(binOf(9, t)).toBe(2)
  })

  it('returns null bin for a null value or missing thresholds', () => {
    expect(binOf(null, [3, 6])).toBe(null)
    expect(binOf(5, null)).toBe(null)
  })

  it('maps a bin pair to a palette color and null when either bin is missing', () => {
    expect(bivariateColor(0, 0)).toBe(BIVARIATE_PALETTE[0][0])
    expect(bivariateColor(2, 2)).toBe(BIVARIATE_PALETTE[2][2])
    expect(bivariateColor(null, 1)).toBe(null)
  })
})
