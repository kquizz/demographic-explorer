// Generates src/data/trifectas.json from per-state control timelines.
//
// A "trifecta" is one party holding the governorship and both legislative chambers.
// Value per state-year is 'R', 'D', or 'divided'. We store the source data as compact
// per-state segments (which are stable and easy to eyeball) and expand to the per-year
// { R: [fips...], D: [fips...] } shape the runtime source consumes; every state absent
// from a year's R/D lists is treated as divided.
//
// Provenance: compiled from state government control history (governor party + chamber
// majorities) and reconciled state-by-state against Ballotpedia's trifecta-change ledger
// ("Historical and potential changes in trifectas"), cross-checked against Wikipedia's
// "Government trifecta" totals. The national D/R totals this produces now match
// Ballotpedia's ledger at every year 2012-2024 (test/trifectas.test.js locks them all).
//
// Chamber-tie note: Ballotpedia counts a tied chamber as controlled by the party of the
// tie-breaking Lt. Governor, and applies it both ways. Virginia (Senate 20-20 in
// 2012-2013, R Lt. Gov) is an R trifecta through 2013 — which is why Wikipedia's aggregate
// shows 24 R for 2013 where Ballotpedia shows 25, since Wikipedia treats the VA tie as
// divided. Connecticut (Senate 18-18 in 2017-2018, D Lt. Gov Wyman) stays a D trifecta by
// the same rule: Ballotpedia records CT as a continuous D trifecta since 2011, despite the
// committee-level power-sharing deal those years. Both cases follow Ballotpedia over
// Wikipedia's tie-as-divided convention. Re-run: `node scripts/build-trifectas.mjs`.
//
// Convention: a year Y is the GOVERNANCE year — control in effect during calendar Y,
// i.e. the result of elections held through November Y-1. This lines up with the ACS
// year slider (poverty in year Y compared to who governed in year Y).

import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const FIRST = 2012
const LAST = 2024

// [fips, name, ...segments] where each segment is [status, startYear, endYear].
// Years not covered by any R/D segment are divided. 'R'/'D' only; divided is implicit.
const STATES = [
  ['01', 'Alabama', ['R', 2012, 2024]],
  ['02', 'Alaska', ['R', 2013, 2014]],
  ['04', 'Arizona', ['R', 2012, 2022]],
  ['05', 'Arkansas', ['D', 2012, 2012], ['R', 2015, 2024]],
  ['06', 'California', ['D', 2012, 2024]],
  ['08', 'Colorado', ['D', 2013, 2014], ['D', 2019, 2024]],
  ['09', 'Connecticut', ['D', 2012, 2024]],
  ['10', 'Delaware', ['D', 2012, 2024]],
  ['12', 'Florida', ['R', 2012, 2024]],
  ['13', 'Georgia', ['R', 2012, 2024]],
  ['15', 'Hawaii', ['D', 2012, 2024]],
  ['16', 'Idaho', ['R', 2012, 2024]],
  ['17', 'Illinois', ['D', 2012, 2014], ['D', 2019, 2024]],
  ['18', 'Indiana', ['R', 2012, 2024]],
  ['19', 'Iowa', ['R', 2017, 2024]],
  ['20', 'Kansas', ['R', 2012, 2018]],
  ['21', 'Kentucky', ['R', 2017, 2019]],
  ['22', 'Louisiana', ['R', 2012, 2015], ['R', 2024, 2024]],
  ['23', 'Maine', ['R', 2012, 2012], ['D', 2019, 2024]],
  ['24', 'Maryland', ['D', 2012, 2014], ['D', 2023, 2024]],
  ['25', 'Massachusetts', ['D', 2012, 2014], ['D', 2023, 2024]],
  ['26', 'Michigan', ['R', 2012, 2018], ['D', 2023, 2024]],
  ['27', 'Minnesota', ['D', 2013, 2014], ['D', 2023, 2024]],
  ['28', 'Mississippi', ['R', 2012, 2024]],
  ['29', 'Missouri', ['R', 2017, 2024]],
  ['30', 'Montana', ['R', 2021, 2024]],
  ['31', 'Nebraska', ['R', 2012, 2024]],
  ['32', 'Nevada', ['R', 2015, 2016], ['D', 2019, 2022]],
  ['33', 'New Hampshire', ['R', 2017, 2018], ['R', 2021, 2024]],
  ['34', 'New Jersey', ['D', 2018, 2024]],
  ['35', 'New Mexico', ['D', 2019, 2024]],
  ['36', 'New York', ['D', 2019, 2024]],
  ['37', 'North Carolina', ['R', 2013, 2016]],
  ['38', 'North Dakota', ['R', 2012, 2024]],
  ['39', 'Ohio', ['R', 2012, 2024]],
  ['40', 'Oklahoma', ['R', 2012, 2024]],
  ['41', 'Oregon', ['D', 2013, 2024]],
  ['42', 'Pennsylvania', ['R', 2012, 2014]],
  ['44', 'Rhode Island', ['D', 2013, 2024]],
  ['45', 'South Carolina', ['R', 2012, 2024]],
  ['46', 'South Dakota', ['R', 2012, 2024]],
  ['47', 'Tennessee', ['R', 2012, 2024]],
  ['48', 'Texas', ['R', 2012, 2024]],
  ['49', 'Utah', ['R', 2012, 2024]],
  ['50', 'Vermont', ['D', 2012, 2016]],
  ['51', 'Virginia', ['R', 2012, 2013], ['D', 2020, 2021]],
  ['53', 'Washington', ['D', 2012, 2012], ['D', 2018, 2024]],
  ['54', 'West Virginia', ['D', 2012, 2014], ['R', 2017, 2024]],
  ['55', 'Wisconsin', ['R', 2012, 2018]],
  ['56', 'Wyoming', ['R', 2012, 2024]]
]

const statusIn = (segments, year) => {
  for (const [status, start, end] of segments) {
    if (year >= start && year <= end) return status
  }
  return 'divided'
}

const names = {}
const byYear = {}
for (let y = FIRST; y <= LAST; y++) byYear[y] = { R: [], D: [] }

for (const [fips, name, ...segments] of STATES) {
  names[fips] = name
  for (let y = FIRST; y <= LAST; y++) {
    const status = statusIn(segments, y)
    if (status === 'R' || status === 'D') byYear[y][status].push(fips)
  }
}

const out = { firstYear: FIRST, lastYear: LAST, names, years: byYear }
const here = dirname(fileURLToPath(import.meta.url))
writeFileSync(join(here, '..', 'src', 'data', 'trifectas.json'), JSON.stringify(out, null, 0) + '\n')

// Print the national counts so a run doubles as a checksum against published totals.
console.log('year   D   R  div')
for (let y = FIRST; y <= LAST; y++) {
  const d = byYear[y].D.length
  const r = byYear[y].R.length
  console.log(`${y}  ${String(d).padStart(2)}  ${String(r).padStart(2)}   ${50 - d - r}`)
}
