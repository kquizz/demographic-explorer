// A bundled data source for county/state presidential results (2020 & 2024), compiled
// from official/AP returns. It mirrors the census client's `fetchFactor` interface so
// the data controller can treat it as just another source.
//   metric 'margin' (default): Dem−Rep margin in points for `electionYear`
//                              (positive = Democratic lean, negative = Republican).
//   metric 'swing':            margin(2024) − margin(2020) in points
//                              (positive = shifted Democratic, negative = shifted Republican).
export function createElectionsSource(data) {
  const marginOf = (entry) => (entry && entry.t ? ((entry.d - entry.r) / entry.t) * 100 : null)

  const keysFor = (yearData, geoLevel, selectedState) =>
    Object.keys(yearData).filter((fips) =>
      geoLevel === 'state'
        ? fips.length === 5 && fips.startsWith(selectedState)
        : fips.length === 2
    )

  const fetchFactor = ({ geoLevel, selectedState, electionYear, metric = 'margin' }) => {
    if (metric === 'swing') {
      const y20 = data['2020'] || {}
      const y24 = data['2024'] || {}
      const rows = keysFor(y24, geoLevel, selectedState).map((fips) => {
        const m20 = marginOf(y20[fips])
        const m24 = marginOf(y24[fips])
        return {
          id: fips,
          name: (y24[fips] || y20[fips]).n,
          value: m20 == null || m24 == null ? null : m24 - m20
        }
      })
      return Promise.resolve(rows)
    }

    const yearData = data[String(electionYear)] || {}
    const rows = keysFor(yearData, geoLevel, selectedState).map((fips) => ({
      id: fips,
      name: yearData[fips].n,
      value: marginOf(yearData[fips])
    }))
    return Promise.resolve(rows)
  }

  return { fetchFactor }
}
