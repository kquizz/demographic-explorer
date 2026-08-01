// Generates src/data/wages.json from the BLS QCEW (Quarterly Census of Employment and
// Wages) Open Data API. We take the average annual pay per state and county — the mean pay
// per covered job — a different economic lens than the ACS median household income the
// census factors expose.
//
// Unlike the LAUS build, this needs no API key and just one request per year: the QCEW
// "by industry" annual endpoint returns every area in a single CSV, and we keep the
// total-all-industries (industry 10), total-ownership (own 0) rows. County rows are 5-digit
// FIPS at aggregation level 70; state totals are FIPS ending in 000 (we key those by their
// 2-digit prefix). Metros ("C..." codes), the U.S. total and micro areas are dropped.
//
// Re-run: `node scripts/build-qcew-wages.mjs`.

import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const us = require('us-atlas/counties-10m.json')

const FIRST = 2014 // the QCEW Open Data API only serves 2014 onward
const LAST = 2023
const API = (year) => `https://data.bls.gov/cew/data/api/${year}/a/industry/10.csv`

// Names from the same TopoJSON the map renders, so labels match the geometry on screen.
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

// The rows have no embedded commas, so a plain split (with quote-stripping) is safe.
const parseRow = (line) => line.split(',').map((f) => f.replace(/^"|"$/g, ''))

const years = {}
for (let y = FIRST; y <= LAST; y++) years[y] = {}

for (let y = FIRST; y <= LAST; y++) {
  const res = await fetch(API(y), { headers: { 'User-Agent': 'demographic-explorer/build' } })
  if (!res.ok) throw new Error(`QCEW request failed for ${y}: HTTP ${res.status}`)
  const lines = (await res.text()).split('\n')
  const header = parseRow(lines[0])
  const col = (name) => header.indexOf(name)
  const [iArea, iOwn, iInd, iPay] =
    [col('area_fips'), col('own_code'), col('industry_code'), col('avg_annual_pay')]

  let states = 0
  let counties = 0
  for (const line of lines.slice(1)) {
    if (!line) continue
    const r = parseRow(line)
    if (r[iOwn] !== '0' || r[iInd] !== '10') continue // total ownership, all industries only
    const area = r[iArea]
    const pay = Number(r[iPay])
    if (!/^\d{5}$/.test(area) || !Number.isFinite(pay) || pay <= 0) continue
    if (area.endsWith('000')) {
      years[y][area.slice(0, 2)] = pay // state total -> 2-digit key
      states++
    } else {
      years[y][area] = pay // county
      counties++
    }
  }
  process.stdout.write(`\r${y}: ${states} states, ${counties} counties`)
}
process.stdout.write('\n')

const out = { firstYear: FIRST, lastYear: LAST, measure: 'Average annual pay (BLS QCEW)', names, years }
const here = dirname(fileURLToPath(import.meta.url))
writeFileSync(join(here, '..', 'src', 'data', 'wages.json'), JSON.stringify(out) + '\n')

// Print the unweighted county mean per year so a run doubles as a sanity check
// (pay rises over time; a broken column would show as a flat or absurd series).
console.log('year  states  counties  mean$')
for (let y = FIRST; y <= LAST; y++) {
  const keys = Object.keys(years[y])
  const co = keys.filter((k) => k.length === 5)
  const mean = co.reduce((a, k) => a + years[y][k], 0) / (co.length || 1)
  console.log(`${y}   ${String(keys.length - co.length).padStart(4)}   ${String(co.length).padStart(6)}   ${Math.round(mean)}`)
}
