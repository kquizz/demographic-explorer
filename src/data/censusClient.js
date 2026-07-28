const BASE = 'https://api.census.gov/data'

const GEO = {
  nation: 'state:*',
  state: 'county:*' // all counties nationwide; the join filters to the selected state
}

// Census "jam"/annotation values for missing or suppressed data are large negatives
// (e.g. -666666666). Every factor we expose is naturally non-negative, so a negative
// or non-numeric value means "no data".
const toValue = (raw) => {
  const n = Number(raw)
  return Number.isFinite(n) && n >= 0 ? n : null
}

// The client interface is:
//   fetchFactor({ variable | variables, dataset, geoLevel, year, compute }) -> rows
// A single-variable factor passes `variable`; a computed factor passes `variables`
// (an ordered list) plus `compute(values)` which derives one value per row.
// `defaultYear` is a fallback; callers normally pass an explicit `year`.
export function createCensusClient({ key, year: defaultYear = 2023 } = {}) {
  const cache = new Map()

  const normalize = (table, geoLevel, cols, compute) => {
    const header = table[0]
    const stateIdx = header.indexOf('state')
    const countyIdx = header.indexOf('county')
    return table.slice(1).map((row) => {
      const values = cols.map((_, i) => toValue(row[1 + i]))
      return {
        id: geoLevel === 'state' ? `${row[stateIdx]}${row[countyIdx]}` : row[stateIdx],
        name: row[0],
        value: compute ? compute(values) : values[0]
      }
    })
  }

  const fetchFactor = async ({ variable, variables, dataset, geoLevel, compute, year }) => {
    const cols = variables ?? [variable]
    const y = year ?? defaultYear
    const cacheKey = `${y}|${dataset}|${cols.join(',')}|${geoLevel}`
    if (cache.has(cacheKey)) return cache.get(cacheKey)

    const params = new URLSearchParams({ get: `NAME,${cols.join(',')}`, for: GEO[geoLevel] })
    if (key) params.set('key', key)

    const res = await fetch(`${BASE}/${y}/${dataset}?${params}`)
    if (!res.ok) {
      throw new Error(`Census request failed (${res.status}) for ${cols.join(',')}`)
    }
    const text = await res.text()
    let table
    try {
      table = JSON.parse(text)
    } catch {
      throw new Error(`Census API returned a non-JSON response for ${cols.join(',')} (check the API key)`)
    }
    const rows = normalize(table, geoLevel, cols, compute)
    cache.set(cacheKey, rows)
    return rows
  }

  return { fetchFactor }
}
