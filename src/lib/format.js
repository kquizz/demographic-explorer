const DASH = '—'

export const formatUsd = (v) =>
  v == null ? DASH : `$${Math.round(v).toLocaleString('en-US')}`

export const formatPercent = (v) =>
  v == null ? DASH : `${v.toFixed(1)}%`

export const formatNumber = (v) =>
  v == null ? DASH : Math.round(v).toLocaleString('en-US')

export const formatDecimal = (v) =>
  v == null ? DASH : v.toFixed(1)
