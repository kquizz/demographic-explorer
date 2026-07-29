// A bundled data source for county/state presidential results (2020 & 2024), compiled
// from official/AP returns. It mirrors the census client's `fetchFactor` interface so
// the data controller can treat it as just another source. The value is the Dem−Rep
// margin in points: positive = Democratic lean, negative = Republican lean.
export function createElectionsSource(data) {
  const fetchFactor = ({ geoLevel, selectedState, electionYear }) => {
    const yearData = data[String(electionYear)] || {}
    const rows = Object.entries(yearData)
      .filter(([fips]) =>
        geoLevel === 'state'
          ? fips.length === 5 && fips.startsWith(selectedState)
          : fips.length === 2
      )
      .map(([fips, v]) => ({
        id: fips,
        name: v.n,
        value: v.t ? ((v.d - v.r) / v.t) * 100 : null
      }))
    return Promise.resolve(rows)
  }

  return { fetchFactor }
}
