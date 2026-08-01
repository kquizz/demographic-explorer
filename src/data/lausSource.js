// A bundled data source for BLS Local Area Unemployment Statistics — the annual-average
// unemployment rate per state and county, keyed by year to line up with the ACS year
// slider. Mirrors the census client's `fetchFactor` interface so the data controller
// treats it as just another source. Values are the rate in percent, or null where BLS has
// no annual figure for that area/year (e.g. counties mid-way through a boundary change).
//
// The bundle intermixes 2-digit state keys and 5-digit county keys per year; like the
// elections source, we pick the ones for the current view by FIPS length: every state at
// the nation level, or the selected state's counties when drilled in.
export function createLausSource(data) {
  const clampYear = (y) => Math.max(data.firstYear, Math.min(data.lastYear, y))

  const keysFor = (bucket, geoLevel, selectedState) =>
    Object.keys(bucket).filter((fips) =>
      geoLevel === 'state'
        ? fips.length === 5 && fips.startsWith(selectedState)
        : fips.length === 2
    )

  const fetchFactor = ({ geoLevel, selectedState, year }) => {
    const bucket = data.years[String(clampYear(year))] ?? {}
    const rows = keysFor(bucket, geoLevel, selectedState).map((fips) => ({
      id: fips, name: data.names[fips] ?? fips, value: bucket[fips]
    }))
    return Promise.resolve(rows)
  }

  return { fetchFactor }
}
