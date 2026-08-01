// Generates src/data/health.json from the County Health Rankings & Roadmaps annual
// analytic data files — county and state life expectancy (years). A health/longevity lens
// that pairs well with the economic and education factors for correlation hunting.
//
// One request per year from countyhealthrankings.org. Columns shift position between
// yearly releases, so we locate them by name. Life expectancy is published from the 2019
// release onward at this path, so earlier slider years show as no data.
//
// Re-run: `node scripts/build-chr-health.mjs`.

import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const us = require('us-atlas/counties-10m.json')

const FIRST = 2019
const LAST = 2023
const URL = (y) =>
  `https://www.countyhealthrankings.org/sites/default/files/media/document/analytic_data${y}.csv`

// Names from the same TopoJSON the map renders.
const stateGeoms = us.objects.states.geometries
const countyGeoms = us.objects.counties.geometries
const stateName = Object.fromEntries(stateGeoms.map((g) => [String(g.id), g.properties.name]))
const names = {}
for (const g of stateGeoms) names[String(g.id)] = g.properties.name
for (const g of countyGeoms) {
  const fips = String(g.id)
  const ss = fips.slice(0, 2)
  names[fips] = stateName[ss] ? `${g.properties.name}, ${stateName[ss]}` : g.properties.name
}

// Minimal RFC-4180 CSV parser — CHR files quote text fields that contain commas, so a
// naive split would misalign the deep life-expectancy column.
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

const findCol = (header, ...terms) =>
  header.findIndex((c) => terms.every((t) => c.toLowerCase().includes(t)))

const years = {}
for (let y = FIRST; y <= LAST; y++) {
  const res = await fetch(URL(y), { headers: { 'User-Agent': 'demographic-explorer/build' } })
  if (!res.ok) throw new Error(`CHR request failed for ${y}: HTTP ${res.status}`)
  const rows = parseCsv(await res.text())
  const header = rows[0]
  const iFips = findCol(header, '5-digit fips')
  const iLE = findCol(header, 'life expectancy', 'raw value')
  if (iFips < 0 || iLE < 0) {
    throw new Error(`CHR ${y}: could not find FIPS (${iFips}) or life-expectancy (${iLE}) column`)
  }

  const bucket = {}
  let states = 0
  let counties = 0
  for (const r of rows.slice(1)) {
    const area = r[iFips]
    const le = Number(r[iLE])
    // Drop implausible estimates: tiny-population counties (some Alaska boroughs) yield
    // life expectancies above 100 or in the 40s that are statistical noise, not real, and
    // would otherwise dominate the color scale. Real US county values sit ~60-92.
    if (!/^\d{5}$/.test(area) || area === '00000' || !(le >= 55 && le <= 95)) continue
    const value = Math.round(le * 10) / 10 // one decimal is plenty and keeps the bundle small
    if (area.endsWith('000')) { bucket[area.slice(0, 2)] = value; states++ }
    else { bucket[area] = value; counties++ }
  }
  years[y] = bucket
  process.stdout.write(`\r${y}: ${states} states, ${counties} counties`)
}
process.stdout.write('\n')

const out = { firstYear: FIRST, lastYear: LAST, measure: 'Life expectancy, years (County Health Rankings)', names, years }
const here = dirname(fileURLToPath(import.meta.url))
writeFileSync(join(here, '..', 'src', 'data', 'health.json'), JSON.stringify(out) + '\n')

// Print the unweighted county mean per year as a sanity check (US life expectancy is
// ~76-79 years and dipped in 2020-2021 with COVID).
console.log('year  states  counties  mean-yrs')
for (let y = FIRST; y <= LAST; y++) {
  const co = Object.keys(years[y]).filter((k) => k.length === 5)
  const mean = co.reduce((a, k) => a + years[y][k], 0) / (co.length || 1)
  console.log(`${y}   ${String(Object.keys(years[y]).length - co.length).padStart(4)}   ${String(co.length).padStart(6)}   ${mean.toFixed(1)}`)
}
