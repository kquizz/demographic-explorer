// A generic bundled data source for a value-per-FIPS-per-year dataset (the shape both the
// BLS LAUS unemployment and QCEW wage bundles share): { firstYear, lastYear, names, years }
// where each years[Y] maps FIPS -> number. Mirrors the census client's `fetchFactor` so the
// controller treats it as just another source. Values are null where the bundle has no
// figure for that area/year.
//
// The bundle intermixes 2-digit state keys and 5-digit county keys per year; like the
// elections source, we pick the ones for the current view by FIPS length: every state at
// the nation level, or the selected state's counties when drilled in.
export function createFipsYearSource(data) {
  const keysFor = (bucket, geoLevel, selectedState) =>
    Object.keys(bucket).filter((fips) =>
      geoLevel === 'state'
        ? fips.length === 5 && fips.startsWith(selectedState)
        : fips.length === 2
    )

  // Years the bundle doesn't cover return no rows, so the map shows "no data" honestly
  // rather than clamping to a neighbouring year's values (QCEW wages start in 2014 while
  // the slider starts in 2012).
  const fetchFactor = ({ geoLevel, selectedState, year }) => {
    const bucket = data.years[String(year)] ?? {}
    const rows = keysFor(bucket, geoLevel, selectedState).map((fips) => ({
      id: fips, name: data.names[fips] ?? fips, value: bucket[fips]
    }))
    return Promise.resolve(rows)
  }

  return { fetchFactor }
}
