const BASE = 'https://datausa.io/api/data'

const LEVEL = {
  nation: { drilldown: 'State', idField: 'ID State', nameField: 'State' },
  state: { drilldown: 'County', idField: 'ID County', nameField: 'County' }
}

const fipsFromGeoid = (geoid) => String(geoid).split('US')[1]

// The client interface is { fetchFactor({ measure, geoLevel }) -> rows }.
// A future Census Bureau adapter can implement the same method and drop in.
export function createDataUsaClient({ year = 'latest' } = {}) {
  const cache = new Map()

  const normalize = (raw, { idField, nameField, measure }) =>
    raw.data.map((row) => ({
      id: fipsFromGeoid(row[idField]),
      name: row[nameField],
      value: typeof row[measure] === 'number' ? row[measure] : null
    }))

  const fetchFactor = async ({ measure, geoLevel }) => {
    const cfg = LEVEL[geoLevel]
    const key = `${measure}|${geoLevel}`
    if (cache.has(key)) return cache.get(key)

    const params = new URLSearchParams({
      drilldowns: cfg.drilldown,
      measures: measure,
      year
    })
    const res = await fetch(`${BASE}?${params.toString().replace(/\+/g, '%20')}`)
    if (!res.ok) {
      throw new Error(`Data USA request failed (${res.status}) for ${measure}`)
    }
    const rows = normalize(await res.json(), { ...cfg, measure })
    cache.set(key, rows)
    return rows
  }

  return { fetchFactor }
}
