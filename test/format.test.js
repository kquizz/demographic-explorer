import { describe, it, expect } from 'vitest'
import { formatUsd, formatPercent, formatNumber, formatDecimal, formatGini } from '../src/lib/format.js'

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
  it('renders null as an em dash', () => {
    expect(formatUsd(null)).toBe('—')
    expect(formatPercent(null)).toBe('—')
    expect(formatNumber(null)).toBe('—')
  })
})
