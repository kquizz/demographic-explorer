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

// The client interface is { fetchFactor({ variable, dataset, geoLevel }) -> rows }.
// A different data source can implement the same method and drop in.
export function createCensusClient({ key, year = 2022 } = {}) {
  const cache = new Map()

  const normalize = (table, geoLevel) => {
    const header = table[0]
    const stateIdx = header.indexOf('state')
    const countyIdx = header.indexOf('county')
    return table.slice(1).map((row) => ({
      id: geoLevel === 'state' ? `${row[stateIdx]}${row[countyIdx]}` : row[stateIdx],
      name: row[0],
      value: toValue(row[1])
    }))
  }

  const fetchFactor = async ({ variable, dataset, geoLevel }) => {
    const cacheKey = `${dataset}|${variable}|${geoLevel}`
    if (cache.has(cacheKey)) return cache.get(cacheKey)

    const params = new URLSearchParams({ get: `NAME,${variable}`, for: GEO[geoLevel] })
    if (key) params.set('key', key)

    const res = await fetch(`${BASE}/${year}/${dataset}?${params}`)
    if (!res.ok) {
      throw new Error(`Census request failed (${res.status}) for ${variable}`)
    }
    const text = await res.text()
    let table
    try {
      table = JSON.parse(text)
    } catch {
      throw new Error(`Census API returned a non-JSON response for ${variable} (check the API key)`)
    }
    const rows = normalize(table, geoLevel)
    cache.set(cacheKey, rows)
    return rows
  }

  return { fetchFactor }
}
