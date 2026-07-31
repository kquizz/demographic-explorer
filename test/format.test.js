import { describe, it, expect } from 'vitest'
import { formatUsd, formatPercent, formatNumber, formatDecimal, formatGini, formatMargin, signed } from '../src/lib/format.js'

describe('formatters', () => {
  it('formats USD with a dollar sign and thousands separators', () => {
    expect(formatUsd(54943)).toBe('$54,943')
  })
  it('formats a percent to one decimal', () => {
    expect(formatPercent(12.3456)).toBe('12.3%')
  })
  it('formats a plain number with separators', () => {
    expect(formatNumber(5024279)).toBe('5,024,279')
  })
  it('formats a decimal to one place', () => {
    expect(formatDecimal(39.3)).toBe('39.3')
    expect(formatDecimal(null)).toBe('—')
  })
  it('formats a gini index to three places', () => {
    expect(formatGini(0.478)).toBe('0.478')
    expect(formatGini(null)).toBe('—')
  })
  it('formats an election margin as D+/R+', () => {
    expect(formatMargin(20.1)).toBe('D+20.1')
    expect(formatMargin(-13.7)).toBe('R+13.7')
    expect(formatMargin(0)).toBe('Even')
    expect(formatMargin(null)).toBe('—')
  })
  it('wraps a base formatter to render a signed delta', () => {
    const s = signed(formatUsd)
    expect(s(1234)).toBe('+$1,234')
    expect(s(-1234)).toBe('−$1,234')
    expect(s(0)).toBe('±$0')
    expect(s(null)).toBe('—')
    expect(signed(formatPercent)(-3.2)).toBe('−3.2%')
  })
  it('renders null as an em dash', () => {
    expect(formatUsd(null)).toBe('—')
    expect(formatPercent(null)).toBe('—')
    expect(formatNumber(null)).toBe('—')
  })
})
