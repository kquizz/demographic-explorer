// Generates src/data/laus.json from the BLS Local Area Unemployment Statistics (LAUS)
// public API. LAUS is the official monthly/annual unemployment measure for states and
// counties — distinct from, and more current than, the ACS 5-year survey estimate the
// census factors expose. We bundle it (rather than fetch at runtime) because BLS requires
// an application/json POST for batch queries, which trips a CORS preflight the browser
// can't clear; the API is happy to serve the same request server-side from this script.
//
// We store the annual-average (BLS period "M13") unemployment rate per area per year,
// keyed by FIPS so it lines up with the map's geometry and the ACS year slider. State
// keys are 2-digit FIPS, county keys are 5-digit — the runtime source picks by length,
// exactly like the elections source.
//
// Requires a free BLS registration key (https://data.bls.gov/registrationEngine/) in
// BLS_API_KEY: a keyed request covers the full 2012-2023 span and all ~3,200 counties in
// ~66 batched queries, well under the 500/day cap. Without a key the API caps at 10 years
// and 25 queries/day, too little for county coverage.
//
// Re-run: `BLS_API_KEY=xxxx node scripts/build-laus.mjs`.

import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
// The same TopoJSON the map renders, so the LAUS bundle covers exactly the areas on screen.
const us = require('us-atlas/counties-10m.json')

const FIRST = 2012
const LAST = 2023
const API = 'https://api.bls.gov/publicAPI/v2/timeseries/data/'
const KEY = process.env.BLS_API_KEY
const CHUNK = 50 // BLS caps a query at 50 series
const MEASURE = '03' // 03 = unemployment rate

if (!KEY) {
  console.error('BLS_API_KEY is required. Register (free) at https://data.bls.gov/registrationEngine/')
  process.exit(1)
}

// Series IDs (not seasonally adjusted). State area code is ST + FIPS(2) + 11 zeros;
// county area code is CN + FIPS(5) + 8 zeros. Verified against live series LAUST06...03
// (California) and LAUCN01001...03 (Autauga County, AL).
// The LAUS area code is 15 chars: ST/CN + FIPS + zero padding. Building the padding with
// repeat() rather than a zero literal so the count can't silently drift (a state needs 11
// trailing zeros, a county 8) — an off-by-one here just yields a series with no data.
const stateSeries = (ss) => `LAU${`ST${ss}${'0'.repeat(11)}`}${MEASURE}`
const countySeries = (fips) => `LAU${`CN${fips}${'0'.repeat(8)}`}${MEASURE}`
const fipsFromSeries = (id) => (id.startsWith('LAUST') ? id.slice(5, 7) : id.slice(5, 10))

const stateGeoms = us.objects.states.geometries
const countyGeoms = us.objects.counties.geometries
const stateName = Object.fromEntries(stateGeoms.map((g) => [String(g.id), g.properties.name]))

const names = {}
const series = []
for (const g of stateGeoms) {
  const ss = String(g.id)
  names[ss] = g.properties.name
  series.push(stateSeries(ss))
}
for (const g of countyGeoms) {
  const fips = String(g.id)
  const ss = fips.slice(0, 2)
  names[fips] = stateName[ss] ? `${g.properties.name}, ${stateName[ss]}` : g.properties.name
  series.push(countySeries(fips))
}

const chunks = []
for (let i = 0; i < series.length; i += CHUNK) chunks.push(series.slice(i, i + CHUNK))

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// BLS occasionally leaks raw ASCII control characters into footnote strings, which is
// invalid JSON. Scrub anything below 0x20 (they only ever appear in text we discard)
// before parsing. Done as a char-code scan to avoid an unreadable control-char regex.
const stripControls = (text) => {
  let out = ''
  for (let i = 0; i < text.length; i++) {
    out += text.charCodeAt(i) < 0x20 ? ' ' : text[i]
  }
  return out
}
const parseBls = (text) => JSON.parse(stripControls(text))

const years = {}
for (let y = FIRST; y <= LAST; y++) years[y] = {}

let fetched = 0
let missing = 0
for (const [i, chunk] of chunks.entries()) {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      seriesid: chunk,
      startyear: String(FIRST),
      endyear: String(LAST),
      annualaverage: true,
      registrationkey: KEY
    })
  })
  const body = parseBls(await res.text())
  if (body.status !== 'REQUEST_SUCCEEDED') {
    throw new Error(`BLS request failed on chunk ${i}: ${JSON.stringify(body.message)}`)
  }
  for (const s of body.Results.series) {
    const fips = fipsFromSeries(s.seriesID)
    const annual = s.data.filter((d) => d.period === 'M13')
    if (annual.length === 0) missing++
    for (const d of annual) {
      const value = Number(d.value)
      if (Number.isFinite(value) && years[d.year]) years[d.year][fips] = value
    }
  }
  fetched += chunk.length
  process.stdout.write(`\rFetched ${fetched}/${series.length} series (chunk ${i + 1}/${chunks.length})`)
  await sleep(150) // be polite to the API between batches
}
process.stdout.write('\n')

const out = { firstYear: FIRST, lastYear: LAST, measure: 'Unemployment rate, annual average (BLS LAUS)', names, years }
const here = dirname(fileURLToPath(import.meta.url))
writeFileSync(join(here, '..', 'src', 'data', 'laus.json'), JSON.stringify(out) + '\n')

// Print per-year coverage and the unweighted county mean so a run doubles as a sanity
// check against known history (national unemployment spiked in 2020, low in 2019/2023).
console.log(`\nSeries with no annual data: ${missing}`)
console.log('year  states  counties  mean%')
for (let y = FIRST; y <= LAST; y++) {
  const keys = Object.keys(years[y])
  const st = keys.filter((k) => k.length === 2)
  const co = keys.filter((k) => k.length === 5)
  const vals = co.map((k) => years[y][k])
  const mean = vals.reduce((a, b) => a + b, 0) / (vals.length || 1)
  console.log(`${y}   ${String(st.length).padStart(4)}   ${String(co.length).padStart(6)}   ${mean.toFixed(1)}`)
}
