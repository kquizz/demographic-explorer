const DASH = '—'

export const formatUsd = (v) =>
  v == null ? DASH : `$${Math.round(v).toLocaleString('en-US')}`

export const formatPercent = (v) =>
  v == null ? DASH : `${v.toFixed(1)}%`

export const formatNumber = (v) =>
  v == null ? DASH : Math.round(v).toLocaleString('en-US')

export const formatDecimal = (v) =>
  v == null ? DASH : v.toFixed(1)

export const formatGini = (v) =>
  v == null ? DASH : v.toFixed(3)

// Signed election margin in points: positive = Democratic lean, negative = Republican.
export const formatMargin = (v) =>
  v == null ? DASH : v === 0 ? 'Even' : v > 0 ? `D+${v.toFixed(1)}` : `R+${(-v).toFixed(1)}`
