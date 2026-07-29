// Classic 3x3 bivariate palette (pink = high A, blue = high B, dark purple = both high).
// Indexed as PALETTE[aBin][bBin], each bin ∈ {0,1,2} (low, mid, high tercile).
export const BIVARIATE_PALETTE = [
  ['#e8e8e8', '#ace4e4', '#5ac8c8'],
  ['#dfb0d6', '#a5add3', '#5698b9'],
  ['#be64ac', '#8c62aa', '#3b4994']
]

// Tercile cut points (~33rd/66th percentile) of the non-null values, or null if none.
export function tercileThresholds(values) {
  const sorted = values.filter((v) => v != null).sort((a, b) => a - b)
  if (sorted.length === 0) return null
  const q = (p) => sorted[Math.floor(p * (sorted.length - 1))]
  return [q(1 / 3), q(2 / 3)]
}

export function binOf(value, thresholds) {
  if (value == null || thresholds == null) return null
  const [t1, t2] = thresholds
  return value < t1 ? 0 : value < t2 ? 1 : 2
}

export function bivariateColor(aBin, bBin) {
  if (aBin == null || bBin == null) return null
  return BIVARIATE_PALETTE[aBin][bBin]
}
