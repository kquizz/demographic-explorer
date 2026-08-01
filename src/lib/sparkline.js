import { scaleLinear } from 'd3-scale'

// Compute pixel coordinates for a small trend line from [{ year, value }] points.
// Null/non-finite values are dropped from the drawn line, but every year still anchors
// the x-domain so the timeline spans the full requested range. A flat series (all equal)
// centers vertically instead of dividing by a zero range. Returns null when there aren't
// at least two plottable points.
export function sparkGeometry(series, { w, h, pad = 6 } = {}) {
  const years = series.map((d) => d.year)
  const points = series.filter((d) => d.value != null && Number.isFinite(d.value))
  if (years.length < 2 || points.length < 2) return null

  const minYear = Math.min(...years)
  const maxYear = Math.max(...years)
  const values = points.map((d) => d.value)
  const minVal = Math.min(...values)
  const maxVal = Math.max(...values)

  const x = scaleLinear().domain([minYear, maxYear]).range([pad, w - pad])
  const y = minVal === maxVal
    ? () => h / 2
    : scaleLinear().domain([minVal, maxVal]).range([h - pad, pad])

  return {
    minYear,
    maxYear,
    minVal,
    maxVal,
    points: points.map((d) => ({ year: d.year, value: d.value, cx: x(d.year), cy: y(d.value) }))
  }
}
