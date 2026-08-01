// A bundled data source for state government trifectas (which party holds the
// governorship and both legislative chambers), keyed by governance year so it lines up
// with the ACS year slider. Mirrors the census client's `fetchFactor` interface so the
// data controller treats it as just another source. Values are categorical strings:
//   'R'       — Republican trifecta
//   'D'       — Democratic trifecta
//   'divided' — split control (governor and legislature not one party)
//   null      — no state government to classify (D.C., territories)
//
// Trifectas are a state-level fact. At the nation view every state carries its own
// status; drilling into a state, its counties all inherit the state's status so the
// map stays coherent rather than going blank.

// Pure lookup, reused by the trifecta comparison panel. Years outside the bundled range
// clamp to the nearest available year so an edge slider position still classifies.
export function trifectaStatus(data, stateFips, year) {
  if (!data.names[stateFips]) return null
  const y = Math.max(data.firstYear, Math.min(data.lastYear, year))
  const bucket = data.years[String(y)]
  if (!bucket) return null
  if (bucket.R.includes(stateFips)) return 'R'
  if (bucket.D.includes(stateFips)) return 'D'
  return 'divided'
}

export function createTrifectasSource(data, geo) {
  const fetchFactor = ({ geoLevel, selectedState, year }) => {
    if (geoLevel === 'state') {
      // Broadcast the selected state's status to each of its counties.
      const status = trifectaStatus(data, selectedState, year)
      const name = data.names[selectedState] ?? selectedState
      const rows = geo.countyFeatures(selectedState).map((f) => ({
        id: String(f.id), name, value: status
      }))
      return Promise.resolve(rows)
    }
    const rows = geo.stateFeatures().map((f) => {
      const fips = String(f.id)
      return { id: fips, name: data.names[fips] ?? fips, value: trifectaStatus(data, fips, year) }
    })
    return Promise.resolve(rows)
  }

  return { fetchFactor }
}
