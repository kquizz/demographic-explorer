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

// Categorical trifecta status. Values are 'R' / 'D' / 'divided'; anything else is no data.
const TRIFECTA_LABELS = { R: 'Republican trifecta', D: 'Democratic trifecta', divided: 'Divided' }
export const formatTrifecta = (v) => TRIFECTA_LABELS[v] ?? DASH

// Signed election margin in points: positive = Democratic lean, negative = Republican.
export const formatMargin = (v) =>
  v == null ? DASH : v === 0 ? 'Even' : v > 0 ? `D+${v.toFixed(1)}` : `R+${(-v).toFixed(1)}`

// Wrap a base formatter to render a signed delta: +$1,234 / −$1,234 / ±$0.
// The base formats the magnitude; we prepend the sign so units stay consistent.
export const signed = (fmt) => (v) => {
  if (v == null) return DASH
  const mag = fmt(Math.abs(v))
  return v > 0 ? `+${mag}` : v < 0 ? `−${mag}` : `±${mag}`
}
