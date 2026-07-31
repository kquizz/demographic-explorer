// Pearson product-moment correlation over [x, y] pairs. Pairs with a null/NaN
// component are dropped. Returns null when fewer than two usable pairs remain or
// either variable has zero variance (correlation is undefined there).
export function pearson(pairs) {
  const pts = pairs.filter(
    ([x, y]) => x != null && y != null && Number.isFinite(x) && Number.isFinite(y)
  )
  const n = pts.length
  if (n < 2) return null
  let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0
  for (const [x, y] of pts) {
    sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y
  }
  const cov = n * sxy - sx * sy
  const dx = n * sxx - sx * sx
  const dy = n * syy - sy * sy
  if (dx <= 0 || dy <= 0) return null
  return cov / Math.sqrt(dx * dy)
}

// Plain-language description of a correlation, e.g. "strong positive".
export function describeCorrelation(r) {
  if (r == null) return 'not enough data'
  const a = Math.abs(r)
  const strength =
    a < 0.2 ? 'very weak' : a < 0.4 ? 'weak' : a < 0.6 ? 'moderate' : a < 0.8 ? 'strong' : 'very strong'
  if (a < 0.05) return 'no correlation'
  return `${strength} ${r > 0 ? 'positive' : 'negative'}`
}
