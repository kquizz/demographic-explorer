import { describe, it, expect } from 'vitest'
import { sparkGeometry } from '../src/lib/sparkline.js'

describe('sparkGeometry', () => {
  it('returns null with fewer than two plottable points', () => {
    expect(sparkGeometry([{ year: 2020, value: 5 }], { w: 100, h: 40 })).toBe(null)
    expect(
      sparkGeometry([{ year: 2020, value: 5 }, { year: 2021, value: null }], { w: 100, h: 40 })
    ).toBe(null)
  })

  it('maps years across the full width and values up the height (y inverted)', () => {
    const g = sparkGeometry(
      [{ year: 2020, value: 10 }, { year: 2021, value: 20 }, { year: 2022, value: 30 }],
      { w: 120, h: 40, pad: 10 }
    )
    expect(g.minYear).toBe(2020)
    expect(g.maxYear).toBe(2022)
    expect(g.minVal).toBe(10)
    expect(g.maxVal).toBe(30)
    expect(g.points[0].cx).toBeCloseTo(10) // first year at left pad
    expect(g.points[2].cx).toBeCloseTo(110) // last year at w - pad
    expect(g.points[0].cy).toBeCloseTo(30) // lowest value at bottom (h - pad)
    expect(g.points[2].cy).toBeCloseTo(10) // highest value at top (pad)
  })

  it('drops null years from the drawn points but keeps them anchoring the x-domain', () => {
    const g = sparkGeometry(
      [{ year: 2020, value: 10 }, { year: 2021, value: null }, { year: 2022, value: 30 }],
      { w: 120, h: 40, pad: 10 }
    )
    expect(g.points.map((p) => p.year)).toEqual([2020, 2022])
    expect(g.minYear).toBe(2020)
    expect(g.maxYear).toBe(2022)
  })

  it('centers a flat series instead of dividing by a zero value-range', () => {
    const g = sparkGeometry(
      [{ year: 2020, value: 7 }, { year: 2021, value: 7 }],
      { w: 100, h: 40, pad: 5 }
    )
    expect(g.points.every((p) => p.cy === 20)).toBe(true) // h / 2
  })
})
