// Generates src/data/rpp.json from the U.S. Bureau of Economic Analysis (BEA) Regional
// Price Parities by state — a cost-of-living index (US = 100) broken into components:
// all items, goods, housing, utilities, and other services. A real cost-of-living lens
// that pairs with income and wages for correlation hunting ("are high-income states just
// expensive?").
//
// BEA publishes this as a keyless zip download, so no API key is needed. RPP is a
// state-level measure (not published per county), so these factors show data at the
// national/state view and no data when drilled into a state's counties.
//
// Re-run: `node scripts/build-rpp.mjs`.

import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createRequire } from 'node:module'
import { unzipSync, strFromU8 } from 'fflate'

const require = createRequire(import.meta.url)
const us = require('us-atlas/counties-10m.json')

const ZIP = 'https://apps.bea.gov/regional/zip/SARPP.zip'
const CSV = 'SARPP_STATE_2008_2024.csv'

// State names from the same TopoJSON the map renders, keyed by 2-digit FIPS.
const names = {}
for (const g of us.objects.states.geometries) names[String(g.id)] = g.properties.name

// The five RPP components, matched by description text (robust to LineCode reordering).
const COMPONENTS = [
  { key: 'all', term: 'all items', measure: 'Regional price parity, all items (US=100)' },
  { key: 'goods', term: 'goods', measure: 'Regional price parity, goods (US=100)' },
  { key: 'housing', term: 'housing', measure: 'Regional price parity, housing (US=100)' },
  { key: 'utilities', term: 'utilities', measure: 'Regional price parity, utilities (US=100)' },
  { key: 'services', term: 'other', measure: 'Regional price parity, other services (US=100)' }
]
const componentKey = (desc) => {
  const d = desc.toLowerCase()
  const hit = COMPONENTS.find((c) => d.includes(c.term))
  return hit ? hit.key : null
}

// Minimal RFC-4180 CSV parser — BEA quotes every field and pads FIPS like "01000".
const parseCsv = (text) => {
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ } else inQuotes = false
      } else field += c
    } else if (c === '"') inQuotes = true
    else if (c === ',') { row.push(field); field = '' }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = '' }
    else if (c !== '\r') field += c
  }
  if (field.length || row.length) { row.push(field); rows.push(row) }
  return rows
}

const res = await fetch(ZIP)
if (!res.ok) throw new Error(`BEA request failed: HTTP ${res.status}`)
const files = unzipSync(new Uint8Array(await res.arrayBuffer()))
if (!files[CSV]) throw new Error(`Expected ${CSV} inside the BEA zip; got ${Object.keys(files)}`)
const rows = parseCsv(strFromU8(files[CSV]))

const header = rows[0]
const iDesc = header.indexOf('Description')
// Year columns are the plain 4-digit headers (2008…2024).
const yearCols = header
  .map((h, i) => ({ year: h.trim(), i }))
  .filter((c) => /^\d{4}$/.test(c.year))
if (iDesc < 0 || yearCols.length === 0) {
  throw new Error(`Could not find Description (${iDesc}) or year columns (${yearCols.length})`)
}

// One fips→value bucket per component per year.
const buckets = Object.fromEntries(COMPONENTS.map((c) => [c.key, {}]))
for (const r of rows.slice(1)) {
  const geo = (r[0] ?? '').trim()
  if (!/^\d{5}$/.test(geo) || geo === '00000') continue // skip US total and footer notes
  const key = componentKey(r[iDesc] ?? '')
  if (!key) continue
  const state = geo.slice(0, 2)
  if (!names[state]) continue // territories not in the map geometry
  for (const { year, i } of yearCols) {
    const v = Number(r[i])
    if (!Number.isFinite(v)) continue
    ;(buckets[key][year] ??= {})[state] = Math.round(v * 10) / 10
  }
}

const years = yearCols.map((c) => Number(c.year))
const firstYear = Math.min(...years)
const lastYear = Math.max(...years)
const out = {}
for (const c of COMPONENTS) {
  out[c.key] = { firstYear, lastYear, measure: c.measure, names, years: buckets[c.key] }
}

const here = dirname(fileURLToPath(import.meta.url))
writeFileSync(join(here, '..', 'src', 'data', 'rpp.json'), JSON.stringify(out) + '\n')

// Sanity check: US=100, so state means should straddle 100 and California should be high.
console.log('component  states(2023)  mean(2023)  CA(2023)')
for (const c of COMPONENTS) {
  const b = out[c.key].years['2023'] ?? {}
  const keys = Object.keys(b)
  const mean = keys.reduce((a, k) => a + b[k], 0) / (keys.length || 1)
  console.log(`${c.key.padEnd(10)} ${String(keys.length).padStart(10)}   ${mean.toFixed(1).padStart(8)}   ${String(b['06'] ?? '—').padStart(6)}`)
}
