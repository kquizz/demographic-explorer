# US Demographics Explorer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **⚠️ Amendment (2026-07-27, during implementation): data source changed to the US Census Bureau API.**
> The originally-planned Data USA endpoint (`datausa.io/api/data`, Task 4) turned out to be **dead** (404s), and its tesseract replacement did not cleanly expose median income or poverty. The build pivoted to the **US Census ACS 5-year API** (the spec's own listed future adapter). Concrete deltas from the tasks below:
> - `src/data/dataUsaClient.js` → **`src/data/censusClient.js`** (`createCensusClient({ key, year })`). Response is an array-of-arrays (header row + rows); FIPS comes from the `state` (+ `county`) geography columns; missing data is a negative "jam" value → `null`. Requires a free API key via `VITE_CENSUS_KEY` (gitignored `.env`).
> - Factors carry **`variable`** (e.g. `B19013_001E`) and **`dataset`** (`acs/acs5` or `acs/acs5/profile`) instead of a Data USA `measure`. The set expanded to 6 clean factors: median income, population, median age, poverty rate, bachelor's-or-higher %, median home value.
> - `client.fetchFactor({ variable, dataset, geoLevel })` (was `{ measure, geoLevel }`).
> - The data controller **scopes `dataset.rows` to the on-screen feature ids** (the county endpoint returns all US counties; ranking/details must reflect only the zoomed state).
> - The map legend renders the factor **label** and **formatted** min/max.
> Everything else (store, join, geo, map, shell, panels, search, error banner, TDD structure) matches the tasks below. All 54 unit tests pass and every feature was verified in-browser against the live Census API.

**Goal:** Build a client-side US demographic explorer: a D3 choropleth that recolors by a chosen Census-derived factor, drills from states into counties, and drives ranking/details/compare/search panels through a single shared store.

**Architecture:** Vanilla JS + D3 v7, bundled by Vite, no backend. Modules communicate only through one pub/sub `store`. A data layer fetches from the Data USA API (behind a thin client interface), joins values onto `us-atlas` TopoJSON by FIPS, and writes a `dataset` into the store; the map and every panel re-read the store and re-render. Foundation modules are built sequentially; the four feature panels are built in parallel against a frozen store contract.

**Tech Stack:** JavaScript (ES modules), D3 v7, topojson-client, us-atlas (TopoJSON), Vite, Vitest + jsdom.

---

## File Structure

```
demographic-explorer/
├── index.html                  # Vite entry; mounts #app
├── package.json                # scripts + deps
├── vite.config.js              # (default; present for clarity)
├── vitest.config.js            # jsdom environment
├── src/
│   ├── main.js                 # composition root: wires store, geo, controller, map, shell, panels
│   ├── store/
│   │   └── store.js            # createStore: getState / setState / subscribe
│   ├── lib/
│   │   └── format.js           # value formatters (usd, percent, number)
│   ├── data/
│   │   ├── factors.js          # FACTORS registry: factor id -> {label, measure, format}
│   │   ├── dataUsaClient.js    # fetch + normalize Data USA responses (behind an interface)
│   │   ├── join.js             # merge normalized rows onto feature ids by FIPS
│   │   └── controller.js       # createDataController: reacts to store, fetches+joins, writes dataset
│   ├── map/
│   │   ├── geo.js              # createGeo: TopoJSON -> state/county features + feature-id lists
│   │   └── map.js              # createMap: D3 choropleth, zoom, legend, hover/click -> store
│   ├── shell/
│   │   └── shell.js            # two-rail collapsible layout, factor picker, tab host, search slot
│   ├── search/
│   │   └── search.js           # mountSearch: header search -> writes selection into store
│   └── panels/
│       ├── ranking.js          # leaderboard for current factor + geo level
│       ├── details.js          # stat sheet for hovered/pinned area
│       └── compare.js          # two-factor comparison (owns its own second-factor state)
└── test/
    └── fixtures/
        ├── datausa-states.json # saved sample Data USA state response
        └── topo-mini.json      # tiny TopoJSON: 2 states, 2 counties (for geo/map tests)
```

## Store Contract (FROZEN — Phase 2 panels depend on this)

`store.getState()` returns an object with this exact shape. Panels **must not** add keys or mutate it directly — only `setState(partial)`.

```js
{
  factor: 'median_income',      // key into FACTORS
  geoLevel: 'nation',           // 'nation' (states shown) | 'state' (counties of selectedState shown)
  selectedState: null,          // 2-digit state FIPS string when zoomed in, else null
  hoveredId: null,              // FIPS of hovered feature, or null
  pinnedId: null,               // FIPS of clicked/pinned feature, or null
  dataset: {                    // written ONLY by the data controller; everything else reads it
    status: 'idle',             // 'idle' | 'loading' | 'ready' | 'error'
    factor: null,               // factor id this dataset is for
    geoLevel: null,             // geo level this dataset is for
    rows: [],                   // [{ id: fips, name, value }] — API rows that HAVE data
    byId: {},                   // { fips -> { id, name, value } } lookup built from rows
    values: {},                 // { fips -> value|null } for EVERY feature id (null = no data)
    extent: [null, null],       // [min, max] of non-null values, for the color scale
    error: null                 // error message when status === 'error'
  }
}
```

Panel contract (every panel and the search module):

```js
// A panel factory returns this object; shell mounts/unmounts it.
{ id: 'ranking', label: 'Ranking', mount(el, store) {}, unmount() {} }
```

---

## Task 1: Project scaffold

**Files:**
- Create: `package.json`, `index.html`, `vite.config.js`, `vitest.config.js`, `src/main.js`
- Test: `test/smoke.test.js`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "demographic-explorer",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "d3": "^7.9.0",
    "topojson-client": "^3.1.0",
    "us-atlas": "^3.0.1"
  },
  "devDependencies": {
    "jsdom": "^24.0.0",
    "vite": "^5.4.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Create `index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>US Demographics Explorer</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.js"></script>
  </body>
</html>
```

- [ ] **Step 3: Create `vite.config.js` and `vitest.config.js`**

`vite.config.js`:

```js
import { defineConfig } from 'vite'

export default defineConfig({})
```

`vitest.config.js`:

```js
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true
  }
})
```

- [ ] **Step 4: Create `src/main.js` stub**

```js
// Composition root — filled in at Task 10.
document.getElementById('app').textContent = 'US Demographics Explorer'
```

- [ ] **Step 5: Write the smoke test**

`test/smoke.test.js`:

```js
import { describe, it, expect } from 'vitest'

describe('toolchain', () => {
  it('runs vitest', () => {
    expect(1 + 1).toBe(2)
  })
})
```

- [ ] **Step 6: Install and run the test**

Run: `npm install && npm test`
Expected: PASS — 1 test passes; confirms Vite/Vitest/jsdom are wired.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json index.html vite.config.js vitest.config.js src/main.js test/smoke.test.js
git commit -m "chore: scaffold vite + vitest project"
```

---

## Task 2: Store (pub/sub single source of truth)

**Files:**
- Create: `src/store/store.js`
- Test: `test/store.test.js`

- [ ] **Step 1: Write the failing test**

`test/store.test.js`:

```js
import { describe, it, expect, vi } from 'vitest'
import { createStore } from '../src/store/store.js'

describe('createStore', () => {
  it('returns the initial state from getState', () => {
    const store = createStore({ factor: 'a', geoLevel: 'nation' })
    expect(store.getState()).toEqual({ factor: 'a', geoLevel: 'nation' })
  })

  it('merges partial updates and notifies subscribers', () => {
    const store = createStore({ factor: 'a', hoveredId: null })
    const seen = vi.fn()
    store.subscribe(seen)
    store.setState({ hoveredId: '01' })
    expect(store.getState()).toEqual({ factor: 'a', hoveredId: '01' })
    expect(seen).toHaveBeenCalledTimes(1)
    expect(seen).toHaveBeenCalledWith(store.getState())
  })

  it('does not notify when setState changes nothing', () => {
    const store = createStore({ factor: 'a' })
    const seen = vi.fn()
    store.subscribe(seen)
    store.setState({ factor: 'a' })
    expect(seen).not.toHaveBeenCalled()
  })

  it('stops notifying after unsubscribe', () => {
    const store = createStore({ n: 0 })
    const seen = vi.fn()
    const off = store.subscribe(seen)
    off()
    store.setState({ n: 1 })
    expect(seen).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/store.test.js`
Expected: FAIL — "createStore is not a function" / module not found.

- [ ] **Step 3: Write minimal implementation**

`src/store/store.js`:

```js
export function createStore(initialState) {
  let state = { ...initialState }
  const listeners = new Set()

  const getState = () => state

  const changed = (partial) =>
    Object.keys(partial).some((k) => partial[k] !== state[k])

  const setState = (partial) => {
    if (!changed(partial)) return
    state = { ...state, ...partial }
    for (const fn of listeners) fn(state)
  }

  const subscribe = (fn) => {
    listeners.add(fn)
    return () => listeners.delete(fn)
  }

  return { getState, setState, subscribe }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/store.test.js`
Expected: PASS — all 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/store/store.js test/store.test.js
git commit -m "feat: add pub/sub store"
```

---

## Task 3: Factor registry + formatters

**Files:**
- Create: `src/lib/format.js`, `src/data/factors.js`
- Test: `test/factors.test.js`, `test/format.test.js`

- [ ] **Step 1: Write the failing tests**

`test/format.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { formatUsd, formatPercent, formatNumber } from '../src/lib/format.js'

describe('formatters', () => {
  it('formats USD with a dollar sign and thousands separators', () => {
    expect(formatUsd(54943)).toBe('$54,943')
  })
  it('formats a percent to one decimal', () => {
    expect(formatPercent(12.3456)).toBe('12.3%')
  })
  it('formats a plain number with separators', () => {
    expect(formatNumber(5024279)).toBe('5,024,279')
  })
  it('renders null as an em dash', () => {
    expect(formatUsd(null)).toBe('—')
    expect(formatPercent(null)).toBe('—')
    expect(formatNumber(null)).toBe('—')
  })
})
```

`test/factors.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { FACTORS, FACTOR_LIST } from '../src/data/factors.js'

describe('FACTORS registry', () => {
  it('exposes an ordered list matching the map', () => {
    expect(FACTOR_LIST.length).toBeGreaterThanOrEqual(4)
    for (const f of FACTOR_LIST) expect(FACTORS[f.id]).toBe(f)
  })
  it('gives every factor an id, label, measure, and format function', () => {
    for (const f of FACTOR_LIST) {
      expect(typeof f.id).toBe('string')
      expect(typeof f.label).toBe('string')
      expect(typeof f.measure).toBe('string')
      expect(typeof f.format).toBe('function')
    }
  })
  it('includes median_income as the default factor', () => {
    expect(FACTORS.median_income).toBeTruthy()
    expect(FACTORS.median_income.format(54943)).toBe('$54,943')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/format.test.js test/factors.test.js`
Expected: FAIL — modules not found.

- [ ] **Step 3: Write the implementations**

`src/lib/format.js`:

```js
const DASH = '—'

export const formatUsd = (v) =>
  v == null ? DASH : `$${Math.round(v).toLocaleString('en-US')}`

export const formatPercent = (v) =>
  v == null ? DASH : `${v.toFixed(1)}%`

export const formatNumber = (v) =>
  v == null ? DASH : Math.round(v).toLocaleString('en-US')
```

`src/data/factors.js`:

```js
import { formatUsd, formatPercent, formatNumber } from '../lib/format.js'

// `measure` is the Data USA API measure name. Verify exact strings against the
// live API in Task 4 (a curl step is included there) and adjust if needed.
export const FACTOR_LIST = [
  { id: 'median_income', label: 'Median income', measure: 'Household Income', format: formatUsd },
  { id: 'population', label: 'Population', measure: 'Population', format: formatNumber },
  { id: 'poverty_rate', label: 'Poverty rate', measure: 'Poverty Rate', format: formatPercent },
  { id: 'median_age', label: 'Median age', measure: 'Median Age', format: formatNumber }
]

export const FACTORS = Object.fromEntries(FACTOR_LIST.map((f) => [f.id, f]))
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/format.test.js test/factors.test.js`
Expected: PASS — all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/format.js src/data/factors.js test/format.test.js test/factors.test.js
git commit -m "feat: add factor registry and value formatters"
```

---

## Task 4: Data USA client (fetch + normalize)

**Files:**
- Create: `src/data/dataUsaClient.js`, `test/fixtures/datausa-states.json`
- Test: `test/dataUsaClient.test.js`

Data USA rows carry a Census GEOID such as `"04000US01"` (state) or `"05000US01001"` (county). The FIPS code is the substring after `US` (`"01"`, `"01001"`), which matches `us-atlas` feature ids. Normalization strips that prefix. Fetch-all-then-filter is intentional: one County request returns every county nationwide, which the join later filters by state — cheaper and more cache-friendly than per-state calls.

- [ ] **Step 1: Create the fixture**

`test/fixtures/datausa-states.json`:

```json
{
  "data": [
    { "ID Year": 2021, "Year": "2021", "ID State": "04000US01", "State": "Alabama", "Household Income": 54943 },
    { "ID Year": 2021, "Year": "2021", "ID State": "04000US02", "State": "Alaska", "Household Income": 80287 },
    { "ID Year": 2021, "Year": "2021", "ID State": "04000US04", "State": "Arizona", "Household Income": null }
  ],
  "source": [{ "measures": ["Household Income"] }]
}
```

- [ ] **Step 2: Write the failing test**

`test/dataUsaClient.test.js`:

```js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import states from './fixtures/datausa-states.json'
import { createDataUsaClient } from '../src/data/dataUsaClient.js'

describe('createDataUsaClient', () => {
  let client
  beforeEach(() => {
    client = createDataUsaClient()
    global.fetch = vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve(states) })
    )
  })
  afterEach(() => { vi.restoreAllMocks() })

  it('requests the State drilldown for the nation level', async () => {
    await client.fetchFactor({ measure: 'Household Income', geoLevel: 'nation' })
    const url = global.fetch.mock.calls[0][0]
    expect(url).toContain('drilldowns=State')
    expect(url).toContain('measures=Household%20Income')
  })

  it('normalizes rows to { id, name, value } with FIPS ids', async () => {
    const rows = await client.fetchFactor({ measure: 'Household Income', geoLevel: 'nation' })
    expect(rows).toEqual([
      { id: '01', name: 'Alabama', value: 54943 },
      { id: '02', name: 'Alaska', value: 80287 },
      { id: '04', name: 'Arizona', value: null }
    ])
  })

  it('caches by measure+geoLevel and does not refetch', async () => {
    await client.fetchFactor({ measure: 'Household Income', geoLevel: 'nation' })
    await client.fetchFactor({ measure: 'Household Income', geoLevel: 'nation' })
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it('throws a helpful error on a non-ok response', async () => {
    global.fetch = vi.fn(() => Promise.resolve({ ok: false, status: 500 }))
    await expect(
      client.fetchFactor({ measure: 'Household Income', geoLevel: 'nation' })
    ).rejects.toThrow(/Data USA request failed/)
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run test/dataUsaClient.test.js`
Expected: FAIL — module not found.

- [ ] **Step 4: Write the implementation**

`src/data/dataUsaClient.js`:

```js
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
    const res = await fetch(`${BASE}?${params}`)
    if (!res.ok) {
      throw new Error(`Data USA request failed (${res.status}) for ${measure}`)
    }
    const rows = normalize(await res.json(), { ...cfg, measure })
    cache.set(key, rows)
    return rows
  }

  return { fetchFactor }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run test/dataUsaClient.test.js`
Expected: PASS — all 4 tests pass.

- [ ] **Step 6: Verify measure names against the live API (real data)**

Run: `curl -s "https://datausa.io/api/data?drilldowns=State&measures=Household%20Income&year=latest" | head -c 400`
Expected: JSON containing `"Household Income"` values per state. If any FACTOR `measure` string in `src/data/factors.js` returns an error or empty `data`, correct it there and re-run Task 3's tests. Save a fresh copy over `test/fixtures/datausa-states.json` if the shape drifted.

- [ ] **Step 7: Commit**

```bash
git add src/data/dataUsaClient.js test/dataUsaClient.test.js test/fixtures/datausa-states.json
git commit -m "feat: add Data USA client with normalization and caching"
```

---

## Task 5: Join (values onto feature ids by FIPS)

**Files:**
- Create: `src/data/join.js`
- Test: `test/join.test.js`

- [ ] **Step 1: Write the failing test**

`test/join.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { join } from '../src/data/join.js'

const rows = [
  { id: '01', name: 'Alabama', value: 54943 },
  { id: '02', name: 'Alaska', value: 80287 }
]

describe('join', () => {
  it('maps every feature id to its value', () => {
    expect(join(['01', '02'], rows)).toEqual({ '01': 54943, '02': 80287 })
  })

  it('fills feature ids with no matching row as null (explicit no-data)', () => {
    expect(join(['01', '99'], rows)).toEqual({ '01': 54943, '99': null })
  })

  it('ignores rows whose id is not in the requested feature set', () => {
    expect(join(['01'], rows)).toEqual({ '01': 54943 })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/join.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

`src/data/join.js`:

```js
export function join(featureIds, rows) {
  const byFips = new Map(rows.map((r) => [r.id, r.value]))
  const out = {}
  for (const id of featureIds) out[id] = byFips.has(id) ? byFips.get(id) : null
  return out
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/join.test.js`
Expected: PASS — all 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/data/join.js test/join.test.js
git commit -m "feat: add FIPS join with explicit no-data handling"
```

---

## Task 6: Geo (TopoJSON features + feature-id lists)

**Files:**
- Create: `src/map/geo.js`, `test/fixtures/topo-mini.json`
- Test: `test/geo.test.js`

`createGeo(topology)` takes an already-loaded TopoJSON object so it is testable with a fixture; `main.js` passes the real `us-atlas` import. State feature ids are 2-digit FIPS; county ids are 5-digit FIPS beginning with their state's 2 digits.

- [ ] **Step 1: Create the mini TopoJSON fixture**

`test/fixtures/topo-mini.json` (two states `01`/`02`, two counties `01001`/`02013`; tiny square geometries):

```json
{
  "type": "Topology",
  "arcs": [
    [[0, 0], [0, 10], [10, 10], [10, 0], [0, 0]],
    [[20, 0], [20, 10], [30, 10], [30, 0], [20, 0]],
    [[0, 0], [0, 5], [5, 5], [5, 0], [0, 0]],
    [[20, 0], [20, 5], [25, 5], [25, 0], [20, 0]]
  ],
  "objects": {
    "states": {
      "type": "GeometryCollection",
      "geometries": [
        { "type": "Polygon", "id": "01", "arcs": [[0]] },
        { "type": "Polygon", "id": "02", "arcs": [[1]] }
      ]
    },
    "counties": {
      "type": "GeometryCollection",
      "geometries": [
        { "type": "Polygon", "id": "01001", "arcs": [[2]] },
        { "type": "Polygon", "id": "02013", "arcs": [[3]] }
      ]
    }
  }
}
```

- [ ] **Step 2: Write the failing test**

`test/geo.test.js`:

```js
import { describe, it, expect } from 'vitest'
import topology from './fixtures/topo-mini.json'
import { createGeo } from '../src/map/geo.js'

describe('createGeo', () => {
  const geo = createGeo(topology)

  it('returns state features with FIPS ids', () => {
    const ids = geo.stateFeatures().map((f) => f.id)
    expect(ids).toEqual(['01', '02'])
  })

  it('filters county features by 2-digit state prefix', () => {
    const ids = geo.countyFeatures('01').map((f) => f.id)
    expect(ids).toEqual(['01001'])
  })

  it('returns all counties when no state prefix is given', () => {
    expect(geo.countyFeatures().map((f) => f.id)).toEqual(['01001', '02013'])
  })

  it('lists state feature ids at nation level', () => {
    expect(geo.featureIds('nation', null)).toEqual(['01', '02'])
  })

  it('lists that state\'s county feature ids at state level', () => {
    expect(geo.featureIds('state', '02')).toEqual(['02013'])
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run test/geo.test.js`
Expected: FAIL — module not found.

- [ ] **Step 4: Write the implementation**

`src/map/geo.js`:

```js
import { feature } from 'topojson-client'

export function createGeo(topology) {
  const states = feature(topology, topology.objects.states).features
  const counties = feature(topology, topology.objects.counties).features

  const stateFeatures = () => states

  const countyFeatures = (statePrefix = null) =>
    statePrefix == null
      ? counties
      : counties.filter((f) => String(f.id).startsWith(statePrefix))

  const featureIds = (geoLevel, selectedState) =>
    geoLevel === 'state'
      ? countyFeatures(selectedState).map((f) => String(f.id))
      : stateFeatures().map((f) => String(f.id))

  return { stateFeatures, countyFeatures, featureIds }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run test/geo.test.js`
Expected: PASS — all 5 tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/map/geo.js test/geo.test.js test/fixtures/topo-mini.json
git commit -m "feat: add geo helper for TopoJSON features and feature ids"
```

---

## Task 7: Data controller (store <-> client <-> join)

**Files:**
- Create: `src/data/controller.js`
- Test: `test/controller.test.js`

The controller is the only writer of `dataset`. It subscribes to the store and, whenever `factor`, `geoLevel`, or `selectedState` changes, fetches rows, joins them onto the current feature ids, and writes a ready (or error) dataset. It de-dupes on the `(factor, geoLevel, selectedState)` key so unrelated changes (hover/pin) don't refetch.

- [ ] **Step 1: Write the failing test**

`test/controller.test.js`:

```js
import { describe, it, expect, vi } from 'vitest'
import { createStore } from '../src/store/store.js'
import { createDataController } from '../src/data/controller.js'

const geoStub = {
  featureIds: (geoLevel) => (geoLevel === 'nation' ? ['01', '02', '99'] : ['01001'])
}
const factorsStub = { median_income: { id: 'median_income', measure: 'Household Income' } }

const initial = {
  factor: null, geoLevel: 'nation', selectedState: null,
  hoveredId: null, pinnedId: null,
  dataset: { status: 'idle', factor: null, geoLevel: null, rows: [], byId: {}, values: {}, extent: [null, null], error: null }
}

describe('createDataController', () => {
  it('loads, joins, and writes a ready dataset when factor is set', async () => {
    const rows = [
      { id: '01', name: 'Alabama', value: 54943 },
      { id: '02', name: 'Alaska', value: 80287 }
    ]
    const client = { fetchFactor: vi.fn(() => Promise.resolve(rows)) }
    const store = createStore(initial)
    createDataController(store, client, geoStub, factorsStub)

    store.setState({ factor: 'median_income' })
    await vi.waitFor(() => expect(store.getState().dataset.status).toBe('ready'))

    const ds = store.getState().dataset
    expect(client.fetchFactor).toHaveBeenCalledWith({ measure: 'Household Income', geoLevel: 'nation' })
    expect(ds.values).toEqual({ '01': 54943, '02': 80287, '99': null })
    expect(ds.byId['01']).toEqual({ id: '01', name: 'Alabama', value: 54943 })
    expect(ds.extent).toEqual([54943, 80287])
    expect(ds.factor).toBe('median_income')
  })

  it('does not refetch when only hoveredId changes', async () => {
    const client = { fetchFactor: vi.fn(() => Promise.resolve([])) }
    const store = createStore(initial)
    createDataController(store, client, geoStub, factorsStub)
    store.setState({ factor: 'median_income' })
    await vi.waitFor(() => expect(store.getState().dataset.status).toBe('ready'))
    store.setState({ hoveredId: '01' })
    expect(client.fetchFactor).toHaveBeenCalledTimes(1)
  })

  it('writes an error dataset when the client rejects', async () => {
    const client = { fetchFactor: vi.fn(() => Promise.reject(new Error('boom'))) }
    const store = createStore(initial)
    createDataController(store, client, geoStub, factorsStub)
    store.setState({ factor: 'median_income' })
    await vi.waitFor(() => expect(store.getState().dataset.status).toBe('error'))
    expect(store.getState().dataset.error).toMatch(/boom/)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/controller.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

`src/data/controller.js`:

```js
import { join } from './join.js'
import { extent } from 'd3-array'

export function createDataController(store, client, geo, factors) {
  let currentKey = null

  const load = async (factor, geoLevel, selectedState) => {
    const measure = factors[factor].measure
    store.setState({
      dataset: { ...store.getState().dataset, status: 'loading', error: null }
    })
    try {
      const rows = await client.fetchFactor({ measure, geoLevel })
      const featureIds = geo.featureIds(geoLevel, selectedState)
      const values = join(featureIds, rows)
      const byId = Object.fromEntries(rows.map((r) => [r.id, r]))
      const [min, max] = extent(rows, (r) => r.value)
      store.setState({
        dataset: {
          status: 'ready', factor, geoLevel, rows, byId, values,
          extent: [min ?? null, max ?? null], error: null
        }
      })
    } catch (err) {
      store.setState({
        dataset: { ...store.getState().dataset, status: 'error', error: err.message }
      })
    }
  }

  store.subscribe((state) => {
    if (!state.factor) return
    const key = `${state.factor}|${state.geoLevel}|${state.selectedState}`
    if (key === currentKey) return
    currentKey = key
    load(state.factor, state.geoLevel, state.selectedState)
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/controller.test.js`
Expected: PASS — all 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/data/controller.js test/controller.test.js
git commit -m "feat: add data controller writing dataset into the store"
```

---

## Task 8: Map (D3 choropleth, zoom, legend, hover/click)

**Files:**
- Create: `src/map/map.js`
- Test: `test/map.test.js`

The map draws state paths at nation level and the selected state's county paths at state level. It owns the color scale (sequential blues over `dataset.extent`) and a legend that includes a distinct "no data" swatch. It reads `dataset.values` for color, writes `hoveredId`/`pinnedId` on pointer events, and sets `geoLevel`/`selectedState` on state click (and a Back control to return to nation).

- [ ] **Step 1: Write the failing test**

`test/map.test.js`:

```js
import { describe, it, expect } from 'vitest'
import topology from './fixtures/topo-mini.json'
import { createStore } from '../src/store/store.js'
import { createGeo } from '../src/map/geo.js'
import { createMap } from '../src/map/map.js'

const baseState = {
  factor: 'median_income', geoLevel: 'nation', selectedState: null,
  hoveredId: null, pinnedId: null,
  dataset: {
    status: 'ready', factor: 'median_income', geoLevel: 'nation',
    rows: [{ id: '01', name: 'Alabama', value: 54943 }],
    byId: { '01': { id: '01', name: 'Alabama', value: 54943 } },
    values: { '01': 54943, '02': null }, extent: [54943, 80287], error: null
  }
}

describe('createMap', () => {
  it('renders one path per state feature at nation level', () => {
    const el = document.createElement('div')
    const store = createStore(baseState)
    createMap(el, createGeo(topology), store)
    expect(el.querySelectorAll('path.feature').length).toBe(2)
  })

  it('marks features with null values as no-data', () => {
    const el = document.createElement('div')
    const store = createStore(baseState)
    createMap(el, createGeo(topology), store)
    const noData = el.querySelector('path.feature[data-id="02"]')
    expect(noData.classList.contains('no-data')).toBe(true)
  })

  it('writes hoveredId to the store on pointerover', () => {
    const el = document.createElement('div')
    const store = createStore(baseState)
    createMap(el, createGeo(topology), store)
    const path = el.querySelector('path.feature[data-id="01"]')
    path.dispatchEvent(new Event('pointerover', { bubbles: true }))
    expect(store.getState().hoveredId).toBe('01')
  })

  it('renders a legend with a no-data swatch', () => {
    const el = document.createElement('div')
    const store = createStore(baseState)
    createMap(el, createGeo(topology), store)
    expect(el.querySelector('.legend')).toBeTruthy()
    expect(el.querySelector('.legend .no-data-swatch')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/map.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

`src/map/map.js`:

```js
import { select } from 'd3-selection'
import { geoAlbersUsa, geoPath } from 'd3-geo'
import { scaleSequential } from 'd3-scale'
import { interpolateBlues } from 'd3-scale-chromatic'

const NO_DATA_FILL = '#e8e8ea'

export function createMap(el, geo, store) {
  const root = select(el).classed('map', true)
  const svg = root.append('svg').attr('class', 'map-svg').attr('viewBox', '0 0 960 600')
  const gFeatures = svg.append('g').attr('class', 'features')
  const legend = root.append('div').attr('class', 'legend')
  const back = root
    .append('button')
    .attr('class', 'back-btn')
    .text('◀ Back to states')
    .style('display', 'none')
    .on('click', () => store.setState({ geoLevel: 'nation', selectedState: null, pinnedId: null }))

  const projection = geoAlbersUsa()
  const path = geoPath(projection)

  const currentFeatures = (state) =>
    state.geoLevel === 'state'
      ? geo.countyFeatures(state.selectedState)
      : geo.stateFeatures()

  const colorFor = (value, scale) =>
    value == null ? NO_DATA_FILL : scale(value)

  const render = (state) => {
    const features = currentFeatures(state)
    const { values, extent } = state.dataset
    const scale = scaleSequential(interpolateBlues).domain(extent[0] == null ? [0, 1] : extent)

    projection.fitSize([960, 600], { type: 'FeatureCollection', features })

    const sel = gFeatures.selectAll('path.feature').data(features, (f) => f.id)
    sel.exit().remove()
    const entered = sel
      .enter()
      .append('path')
      .attr('class', 'feature')
      .attr('data-id', (f) => String(f.id))
      .on('pointerover', (_e, f) => store.setState({ hoveredId: String(f.id) }))
      .on('pointerout', () => store.setState({ hoveredId: null }))
      .on('click', (_e, f) => {
        if (store.getState().geoLevel === 'nation') {
          store.setState({ geoLevel: 'state', selectedState: String(f.id), pinnedId: null })
        } else {
          store.setState({ pinnedId: String(f.id) })
        }
      })

    entered
      .merge(sel)
      .attr('d', path)
      .attr('fill', (f) => colorFor(values[String(f.id)], scale))
      .classed('no-data', (f) => values[String(f.id)] == null)
      .classed('pinned', (f) => String(f.id) === state.pinnedId)

    back.style('display', state.geoLevel === 'state' ? 'block' : 'none')
    renderLegend(state, scale)
  }

  const renderLegend = (state, scale) => {
    const [min, max] = state.dataset.extent
    const factorLabel = state.dataset.factor || ''
    legend.html('')
    legend.append('div').attr('class', 'legend-title').text(factorLabel)
    const ramp = legend.append('div').attr('class', 'ramp')
    if (min != null) {
      ramp.append('span').attr('class', 'lo').text(String(min))
      ramp
        .append('span')
        .attr('class', 'bar')
        .style('background', `linear-gradient(90deg, ${scale(min)}, ${scale(max)})`)
      ramp.append('span').attr('class', 'hi').text(String(max))
    }
    const nd = legend.append('div').attr('class', 'no-data-row')
    nd.append('span').attr('class', 'no-data-swatch').style('background', NO_DATA_FILL)
    nd.append('span').text('No data')
  }

  const unsub = store.subscribe(render)
  render(store.getState())
  return { unmount: () => { unsub(); root.selectAll('*').remove() } }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/map.test.js`
Expected: PASS — all 4 tests pass. (d3-geo/topojson run in jsdom; projection math is pure JS.)

- [ ] **Step 5: Commit**

```bash
git add src/map/map.js test/map.test.js
git commit -m "feat: add D3 choropleth map with zoom, legend, and no-data handling"
```

---

## Task 9: Shell (layout, factor picker, tab host, collapse)

**Files:**
- Create: `src/shell/shell.js`
- Test: `test/shell.test.js`

The shell builds the approved layout: header (title + `#search-slot`), collapsible left factor rail, center `#map-slot`, collapsible right rail with tabs. It renders one factor pill per `FACTOR_LIST` entry (active pill reflects `store.factor`; clicking sets it) and hosts the panel tabs — mounting the active panel and unmounting the previous one on switch.

- [ ] **Step 1: Write the failing test**

`test/shell.test.js`:

```js
import { describe, it, expect, vi } from 'vitest'
import { createStore } from '../src/store/store.js'
import { createShell } from '../src/shell/shell.js'

const factorList = [
  { id: 'median_income', label: 'Median income' },
  { id: 'population', label: 'Population' }
]

const makePanel = (id) => ({
  id, label: id, mount: vi.fn(), unmount: vi.fn()
})

const initial = { factor: 'median_income', geoLevel: 'nation', selectedState: null,
  hoveredId: null, pinnedId: null, dataset: { status: 'idle' } }

describe('createShell', () => {
  it('renders map, search, and factor-rail slots', () => {
    const el = document.createElement('div')
    createShell(el, createStore(initial), { factorList, panels: [makePanel('ranking')] })
    expect(el.querySelector('#map-slot')).toBeTruthy()
    expect(el.querySelector('#search-slot')).toBeTruthy()
    expect(el.querySelectorAll('.factor-pill').length).toBe(2)
  })

  it('marks the active factor pill and sets factor on click', () => {
    const el = document.createElement('div')
    const store = createStore(initial)
    createShell(el, store, { factorList, panels: [makePanel('ranking')] })
    const pop = el.querySelector('.factor-pill[data-id="population"]')
    pop.dispatchEvent(new Event('click', { bubbles: true }))
    expect(store.getState().factor).toBe('population')
    expect(el.querySelector('.factor-pill.on[data-id="population"]')).toBeTruthy()
  })

  it('mounts the first panel and switches on tab click', () => {
    const el = document.createElement('div')
    const store = createStore(initial)
    const ranking = makePanel('ranking')
    const details = makePanel('details')
    createShell(el, store, { factorList, panels: [ranking, details] })
    expect(ranking.mount).toHaveBeenCalledTimes(1)
    el.querySelector('.tab[data-id="details"]').dispatchEvent(new Event('click', { bubbles: true }))
    expect(ranking.unmount).toHaveBeenCalledTimes(1)
    expect(details.mount).toHaveBeenCalledTimes(1)
  })

  it('collapses a rail when its toggle is clicked', () => {
    const el = document.createElement('div')
    createShell(el, createStore(initial), { factorList, panels: [makePanel('ranking')] })
    const rail = el.querySelector('.rail-left')
    el.querySelector('.rail-left .collapse-toggle').dispatchEvent(new Event('click', { bubbles: true }))
    expect(rail.classList.contains('collapsed')).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/shell.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

`src/shell/shell.js`:

```js
export function createShell(el, store, { factorList, panels }) {
  el.classList.add('shell')
  el.innerHTML = `
    <header class="topbar">
      <span class="app-title">US Demographics Explorer</span>
      <span id="search-slot"></span>
    </header>
    <div class="body-row">
      <aside class="rail rail-left">
        <button class="collapse-toggle" aria-label="Collapse factors">◀</button>
        <div class="rail-title">FACTOR</div>
        <div class="factor-list"></div>
      </aside>
      <main id="map-slot" class="map-slot"></main>
      <aside class="rail rail-right">
        <button class="collapse-toggle" aria-label="Collapse analysis">▶</button>
        <div class="tabs"></div>
        <div class="panel-body" id="panel-slot"></div>
      </aside>
    </div>
  `

  const factorListEl = el.querySelector('.factor-list')
  factorList.forEach((f) => {
    const pill = document.createElement('button')
    pill.className = 'factor-pill'
    pill.dataset.id = f.id
    pill.textContent = f.label
    pill.addEventListener('click', () => store.setState({ factor: f.id }))
    factorListEl.appendChild(pill)
  })

  const syncPills = (state) => {
    factorListEl.querySelectorAll('.factor-pill').forEach((p) =>
      p.classList.toggle('on', p.dataset.id === state.factor)
    )
  }

  const tabsEl = el.querySelector('.tabs')
  const panelSlot = el.querySelector('#panel-slot')
  let active = null

  const activate = (panel) => {
    if (active) active.unmount()
    panelSlot.innerHTML = ''
    tabsEl.querySelectorAll('.tab').forEach((t) =>
      t.classList.toggle('on', t.dataset.id === panel.id)
    )
    panel.mount(panelSlot, store)
    active = panel
  }

  panels.forEach((panel) => {
    const tab = document.createElement('button')
    tab.className = 'tab'
    tab.dataset.id = panel.id
    tab.textContent = panel.label
    tab.addEventListener('click', () => activate(panel))
    tabsEl.appendChild(tab)
  })

  el.querySelectorAll('.rail').forEach((rail) => {
    rail.querySelector('.collapse-toggle').addEventListener('click', () =>
      rail.classList.toggle('collapsed')
    )
  })

  store.subscribe(syncPills)
  syncPills(store.getState())
  if (panels.length) activate(panels[0])

  return { mapSlot: el.querySelector('#map-slot'), searchSlot: el.querySelector('#search-slot') }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/shell.test.js`
Expected: PASS — all 4 tests pass.

- [ ] **Step 5: Add stylesheet and commit**

Create `src/shell/shell.css` (imported in Task 10) implementing the mockup — dark header, light rails, `.collapsed { width: 28px }`, active pill/tab accents. Minimum needed for a usable layout:

```css
.shell { font: 14px system-ui, sans-serif; color: #333; }
.topbar { background: #2b3a55; color: #fff; padding: 8px 12px; display: flex; align-items: center; gap: 12px; }
.topbar .app-title { font-weight: 600; }
.topbar #search-slot { margin-left: auto; }
.body-row { display: flex; height: calc(100vh - 40px); }
.rail { background: #eef1f6; padding: 10px; width: 180px; transition: width .2s; overflow: hidden; }
.rail.collapsed { width: 28px; padding: 10px 4px; }
.rail.collapsed .rail-title, .rail.collapsed .factor-list,
.rail.collapsed .tabs, .rail.collapsed .panel-body { display: none; }
.rail-title { font-size: 11px; color: #778; margin: 6px 0; }
.factor-pill, .tab { display: block; width: 100%; text-align: left; background: #fff;
  border: 1px solid #cbd3e1; border-radius: 6px; padding: 6px 8px; margin-bottom: 6px; cursor: pointer; }
.factor-pill.on { background: #3b6cc4; color: #fff; border-color: #3b6cc4; }
.tabs { display: flex; gap: 4px; }
.tab { margin-bottom: 8px; }
.tab.on { border-bottom: 2px solid #3b6cc4; font-weight: 600; }
.map-slot { flex: 1; position: relative; background: linear-gradient(135deg, #dfe8dc, #cfe0d6); }
.map .map-svg { width: 100%; height: 100%; }
.map .legend { position: absolute; left: 12px; bottom: 12px; background: #fff;
  border: 1px solid #cbd3e1; border-radius: 6px; padding: 6px 8px; font-size: 11px; }
.map .legend .bar { display: inline-block; width: 90px; height: 8px; margin: 0 6px; vertical-align: middle; }
.map .legend .no-data-swatch { display: inline-block; width: 10px; height: 10px; margin-right: 4px;
  border: 1px solid #cbd3e1; vertical-align: middle; }
.map .back-btn { position: absolute; left: 12px; top: 12px; }
.feature { stroke: #fff; stroke-width: 0.5; cursor: pointer; }
.feature.pinned { stroke: #222; stroke-width: 1.5; }
```

```bash
git add src/shell/shell.js src/shell/shell.css test/shell.test.js
git commit -m "feat: add collapsible two-rail shell with factor picker and tabs"
```

---

## Task 10: Composition root (wire foundation) — MILESTONE

**Files:**
- Modify: `src/main.js`
- Test: manual browser verification

- [ ] **Step 1: Write the composition root**

`src/main.js`:

```js
import us from 'us-atlas/counties-10m.json'
import './shell/shell.css'
import { createStore } from './store/store.js'
import { createGeo } from './map/geo.js'
import { createDataUsaClient } from './data/dataUsaClient.js'
import { createDataController } from './data/controller.js'
import { createMap } from './map/map.js'
import { createShell } from './shell/shell.js'
import { FACTOR_LIST, FACTORS } from './data/factors.js'
import { createRankingPanel } from './panels/ranking.js'
import { createDetailsPanel } from './panels/details.js'
import { createComparePanel } from './panels/compare.js'
import { mountSearch } from './search/search.js'

const store = createStore({
  factor: null, geoLevel: 'nation', selectedState: null,
  hoveredId: null, pinnedId: null,
  dataset: { status: 'idle', factor: null, geoLevel: null, rows: [], byId: {},
    values: {}, extent: [null, null], error: null }
})

const geo = createGeo(us)
const client = createDataUsaClient()
createDataController(store, client, geo, FACTORS)

const panels = [createRankingPanel(), createDetailsPanel(), createComparePanel()]
const { mapSlot, searchSlot } = createShell(document.getElementById('app'), store, {
  factorList: FACTOR_LIST, panels
})

createMap(mapSlot, geo, store)
mountSearch(searchSlot, store, geo)

store.setState({ factor: 'median_income' })
```

Note: this imports the Phase-2 panels and search. To run the milestone before Phase 2 exists, temporarily stub them (a factory returning `{ id, label, mount(){}, unmount(){} }` / a no-op `mountSearch`), or reach this task after Phase 2. The milestone below only requires map + shell.

- [ ] **Step 2: Run the dev server and verify (manual)**

Run: `npm run dev`
Open the printed localhost URL. Expected:
- US map renders, colored by median income (darker = higher).
- Left rail lists factor pills; "Median income" is active.
- Switching to "Population" recolors the map and legend.
- Hovering a state does not error; clicking a state zooms into its counties and shows "◀ Back to states"; counties recolor by the county-level data.
- Clicking Back returns to the national state view.
- A state/county with no data shows the grey no-data fill and the legend shows the no-data swatch.

- [ ] **Step 3: Run the full test suite**

Run: `npm test`
Expected: PASS — all foundation tests green.

- [ ] **Step 4: Commit**

```bash
git add src/main.js
git commit -m "feat: wire foundation — map colors by factor, zoom into counties"
```

---

## Task 11: Ranking panel (parallelizable)

**Files:**
- Create: `src/panels/ranking.js`
- Test: `test/ranking.test.js`

Depends only on the **frozen store contract**. Renders a sorted leaderboard from `dataset.rows` for the current factor, formatting each value with `FACTORS[factor].format`.

- [ ] **Step 1: Write the failing test**

`test/ranking.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { createStore } from '../src/store/store.js'
import { createRankingPanel } from '../src/panels/ranking.js'

const state = {
  factor: 'median_income', geoLevel: 'nation', selectedState: null,
  hoveredId: null, pinnedId: null,
  dataset: {
    status: 'ready', factor: 'median_income', geoLevel: 'nation',
    rows: [
      { id: '01', name: 'Alabama', value: 54943 },
      { id: '02', name: 'Alaska', value: 80287 },
      { id: '04', name: 'Arizona', value: null }
    ],
    byId: {}, values: {}, extent: [54943, 80287], error: null
  }
}

describe('createRankingPanel', () => {
  it('lists areas sorted by value descending, formatted, no-data excluded', () => {
    const el = document.createElement('div')
    const store = createStore(state)
    createRankingPanel().mount(el, store)
    const rows = [...el.querySelectorAll('.rank-row')].map((r) => r.textContent)
    expect(rows[0]).toContain('Alaska')
    expect(rows[0]).toContain('$80,287')
    expect(rows[1]).toContain('Alabama')
    expect(rows.some((r) => r.includes('Arizona'))).toBe(false)
  })

  it('re-renders when the dataset changes', () => {
    const el = document.createElement('div')
    const store = createStore(state)
    createRankingPanel().mount(el, store)
    store.setState({ dataset: { ...state.dataset,
      rows: [{ id: '05', name: 'Arkansas', value: 52000 }] } })
    expect(el.textContent).toContain('Arkansas')
    expect(el.textContent).not.toContain('Alaska')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/ranking.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

`src/panels/ranking.js`:

```js
import { FACTORS } from '../data/factors.js'

export function createRankingPanel() {
  let el = null
  let unsub = null

  const render = (store) => {
    const { dataset, factor } = store.getState()
    const fmt = FACTORS[factor]?.format ?? String
    const ranked = dataset.rows
      .filter((r) => r.value != null)
      .sort((a, b) => b.value - a.value)

    el.innerHTML = '<div class="rank-list"></div>'
    const list = el.querySelector('.rank-list')
    ranked.forEach((r, i) => {
      const row = document.createElement('div')
      row.className = 'rank-row'
      row.innerHTML =
        `<span class="rank">${i + 1}</span>` +
        `<span class="name">${r.name}</span>` +
        `<span class="value">${fmt(r.value)}</span>`
      list.appendChild(row)
    })
  }

  return {
    id: 'ranking',
    label: 'Ranking',
    mount(mountEl, store) {
      el = mountEl
      unsub = store.subscribe(() => render(store))
      render(store)
    },
    unmount() {
      if (unsub) unsub()
      if (el) el.innerHTML = ''
      el = unsub = null
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/ranking.test.js`
Expected: PASS — both tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/panels/ranking.js test/ranking.test.js
git commit -m "feat: add ranking panel"
```

---

## Task 12: Details panel (parallelizable)

**Files:**
- Create: `src/panels/details.js`
- Test: `test/details.test.js`

Shows the stat sheet for the pinned area, falling back to the hovered area. Looks up `dataset.byId[id]`; when the id is absent (no data), shows the id and "No data".

- [ ] **Step 1: Write the failing test**

`test/details.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { createStore } from '../src/store/store.js'
import { createDetailsPanel } from '../src/panels/details.js'

const state = {
  factor: 'median_income', geoLevel: 'nation', selectedState: null,
  hoveredId: null, pinnedId: null,
  dataset: {
    status: 'ready', factor: 'median_income', geoLevel: 'nation', rows: [],
    byId: { '01': { id: '01', name: 'Alabama', value: 54943 } },
    values: { '01': 54943, '02': null }, extent: [54943, 80287], error: null
  }
}

describe('createDetailsPanel', () => {
  it('prompts when nothing is hovered or pinned', () => {
    const el = document.createElement('div')
    createDetailsPanel().mount(el, createStore(state))
    expect(el.textContent).toMatch(/hover|select/i)
  })

  it('shows the hovered area name and formatted value', () => {
    const el = document.createElement('div')
    const store = createStore(state)
    createDetailsPanel().mount(el, store)
    store.setState({ hoveredId: '01' })
    expect(el.textContent).toContain('Alabama')
    expect(el.textContent).toContain('$54,943')
  })

  it('prefers pinnedId over hoveredId', () => {
    const el = document.createElement('div')
    const store = createStore({ ...state, hoveredId: '02', pinnedId: '01' })
    createDetailsPanel().mount(el, store)
    expect(el.textContent).toContain('Alabama')
  })

  it('shows No data for an id absent from byId', () => {
    const el = document.createElement('div')
    const store = createStore(state)
    createDetailsPanel().mount(el, store)
    store.setState({ hoveredId: '02' })
    expect(el.textContent).toMatch(/no data/i)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/details.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

`src/panels/details.js`:

```js
import { FACTORS } from '../data/factors.js'

export function createDetailsPanel() {
  let el = null
  let unsub = null

  const render = (store) => {
    const { dataset, factor, hoveredId, pinnedId } = store.getState()
    const id = pinnedId ?? hoveredId
    const fmt = FACTORS[factor]?.format ?? String
    const label = FACTORS[factor]?.label ?? factor

    if (!id) {
      el.innerHTML = '<p class="details-empty">Hover or select an area to see details.</p>'
      return
    }
    const entry = dataset.byId[id]
    if (!entry) {
      el.innerHTML =
        `<div class="details"><h3>${id}</h3>` +
        `<div class="stat"><span>${label}</span><span>No data</span></div></div>`
      return
    }
    el.innerHTML =
      `<div class="details"><h3>${entry.name}</h3>` +
      `<div class="stat"><span>${label}</span><span>${fmt(entry.value)}</span></div></div>`
  }

  return {
    id: 'details',
    label: 'Details',
    mount(mountEl, store) {
      el = mountEl
      unsub = store.subscribe(() => render(store))
      render(store)
    },
    unmount() {
      if (unsub) unsub()
      if (el) el.innerHTML = ''
      el = unsub = null
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/details.test.js`
Expected: PASS — all 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/panels/details.js test/details.test.js
git commit -m "feat: add details panel"
```

---

## Task 13: Search (parallelizable)

**Files:**
- Create: `src/search/search.js`
- Test: `test/search.test.js`

Mounts into the header `#search-slot`. Matches typed text against state and county names (from `dataset.rows` plus the state list) and, on selection, writes `selectedState`/`geoLevel`/`pinnedId` into the store so the map zooms and details reflect it.

- [ ] **Step 1: Write the failing test**

`test/search.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { createStore } from '../src/store/store.js'
import { mountSearch } from '../src/search/search.js'

const geoStub = {
  stateFeatures: () => [{ id: '01' }, { id: '02' }]
}
const state = {
  factor: 'median_income', geoLevel: 'nation', selectedState: null,
  hoveredId: null, pinnedId: null,
  dataset: {
    status: 'ready', factor: 'median_income', geoLevel: 'nation',
    rows: [
      { id: '01', name: 'Alabama', value: 54943 },
      { id: '02', name: 'Alaska', value: 80287 }
    ],
    byId: {}, values: {}, extent: [54943, 80287], error: null
  }
}

describe('mountSearch', () => {
  it('renders an input', () => {
    const el = document.createElement('div')
    mountSearch(el, createStore(state), geoStub)
    expect(el.querySelector('input.search-input')).toBeTruthy()
  })

  it('suggests matches as the user types', () => {
    const el = document.createElement('div')
    mountSearch(el, createStore(state), geoStub)
    const input = el.querySelector('input.search-input')
    input.value = 'alab'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    const options = [...el.querySelectorAll('.search-option')].map((o) => o.textContent)
    expect(options).toEqual(['Alabama'])
  })

  it('pins the selection and updates the store on click', () => {
    const el = document.createElement('div')
    const store = createStore(state)
    mountSearch(el, store, geoStub)
    const input = el.querySelector('input.search-input')
    input.value = 'alas'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    el.querySelector('.search-option').dispatchEvent(new Event('click', { bubbles: true }))
    expect(store.getState().pinnedId).toBe('02')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/search.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

`src/search/search.js`:

```js
export function mountSearch(el, store, geo) {
  el.innerHTML =
    '<input class="search-input" type="search" placeholder="Search state or county…" />' +
    '<div class="search-options"></div>'
  const input = el.querySelector('.search-input')
  const options = el.querySelector('.search-options')

  const candidates = () => store.getState().dataset.rows

  const select = (row) => {
    // 2-digit id => state (zoom in); 5-digit id => county (pin within its state)
    if (String(row.id).length <= 2) {
      store.setState({ geoLevel: 'state', selectedState: String(row.id), pinnedId: null })
    } else {
      store.setState({
        geoLevel: 'state',
        selectedState: String(row.id).slice(0, 2),
        pinnedId: String(row.id)
      })
    }
    input.value = row.name
    options.innerHTML = ''
  }

  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase()
    options.innerHTML = ''
    if (!q) return
    candidates()
      .filter((r) => r.name.toLowerCase().includes(q))
      .slice(0, 8)
      .forEach((r) => {
        const opt = document.createElement('button')
        opt.className = 'search-option'
        opt.textContent = r.name
        opt.addEventListener('click', () => select(r))
        options.appendChild(opt)
      })
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/search.test.js`
Expected: PASS — all 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/search/search.js test/search.test.js
git commit -m "feat: add header search with name matching"
```

---

## Task 14: Compare panel (parallelizable, most involved)

**Files:**
- Create: `src/panels/compare.js`
- Test: `test/compare.test.js`

Compares the store's current `factor` (factor A) against a second factor (factor B) the panel picks locally — factor B is **panel-local state**, keeping the store contract frozen. v1 renders a side-by-side numeric comparison table for the current geo level, showing each area's A and B values. (A bivariate/dual-map rendering is the deferred enhancement noted in the spec; the transform below is the seam it would build on.) Because it needs factor B's data too, it uses its own `createDataUsaClient` instance to fetch B on demand.

- [ ] **Step 1: Write the failing test**

`test/compare.test.js`:

```js
import { describe, it, expect, vi } from 'vitest'
import { createStore } from '../src/store/store.js'
import { createComparePanel } from '../src/panels/compare.js'

const state = {
  factor: 'median_income', geoLevel: 'nation', selectedState: null,
  hoveredId: null, pinnedId: null,
  dataset: {
    status: 'ready', factor: 'median_income', geoLevel: 'nation',
    rows: [
      { id: '01', name: 'Alabama', value: 54943 },
      { id: '02', name: 'Alaska', value: 80287 }
    ],
    byId: {}, values: {}, extent: [54943, 80287], error: null
  }
}

describe('createComparePanel', () => {
  it('renders a factor-B picker excluding factor A', () => {
    const el = document.createElement('div')
    const client = { fetchFactor: vi.fn(() => Promise.resolve([])) }
    createComparePanel({ client }).mount(el, createStore(state))
    const opts = [...el.querySelectorAll('.compare-pick option')].map((o) => o.value)
    expect(opts).not.toContain('median_income')
    expect(opts).toContain('population')
  })

  it('builds a side-by-side table after factor B is chosen', async () => {
    const el = document.createElement('div')
    const store = createStore(state)
    const bRows = [
      { id: '01', name: 'Alabama', value: 5024279 },
      { id: '02', name: 'Alaska', value: 733391 }
    ]
    const client = { fetchFactor: vi.fn(() => Promise.resolve(bRows)) }
    createComparePanel({ client }).mount(el, store)

    const pick = el.querySelector('.compare-pick')
    pick.value = 'population'
    pick.dispatchEvent(new Event('change', { bubbles: true }))

    await vi.waitFor(() => expect(el.querySelector('.compare-row')).toBeTruthy())
    const first = el.querySelector('.compare-row').textContent
    expect(first).toContain('Alabama')
    expect(first).toContain('$54,943')     // factor A formatted
    expect(first).toContain('5,024,279')   // factor B formatted
    expect(client.fetchFactor).toHaveBeenCalledWith({ measure: 'Population', geoLevel: 'nation' })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/compare.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

`src/panels/compare.js`:

```js
import { FACTOR_LIST, FACTORS } from '../data/factors.js'
import { createDataUsaClient } from '../data/dataUsaClient.js'

export function createComparePanel({ client = createDataUsaClient() } = {}) {
  let el = null
  let unsub = null
  let factorB = null
  let bRowsById = {}

  const buildTable = (store) => {
    const { dataset, factor } = store.getState()
    const fmtA = FACTORS[factor].format
    const fmtB = factorB ? FACTORS[factorB].format : String
    const rows = dataset.rows.slice().sort((a, b) => a.name.localeCompare(b.name))

    const body = rows
      .map((r) => {
        const bVal = bRowsById[r.id]
        return (
          `<div class="compare-row"><span class="name">${r.name}</span>` +
          `<span class="a">${fmtA(r.value)}</span>` +
          `<span class="b">${factorB ? fmtB(bVal == null ? null : bVal) : ''}</span></div>`
        )
      })
      .join('')
    el.querySelector('.compare-table').innerHTML = body
  }

  const loadB = async (store) => {
    const measure = FACTORS[factorB].measure
    const geoLevel = store.getState().geoLevel
    const rows = await client.fetchFactor({ measure, geoLevel })
    bRowsById = Object.fromEntries(rows.map((r) => [r.id, r.value]))
    buildTable(store)
  }

  const renderPicker = (store) => {
    const { factor } = store.getState()
    const opts = FACTOR_LIST.filter((f) => f.id !== factor)
      .map((f) => `<option value="${f.id}">${f.label}</option>`)
      .join('')
    el.innerHTML =
      `<div class="compare"><label>Compare with:` +
      `<select class="compare-pick"><option value="">— pick a factor —</option>${opts}</select>` +
      `</label><div class="compare-table"></div></div>`
    el.querySelector('.compare-pick').addEventListener('change', (e) => {
      factorB = e.target.value || null
      bRowsById = {}
      if (factorB) loadB(store)
      else buildTable(store)
    })
  }

  return {
    id: 'compare',
    label: 'Compare',
    mount(mountEl, store) {
      el = mountEl
      renderPicker(store)
      unsub = store.subscribe(() => {
        // Rebuild picker if factor A changed; refresh B data on geo change.
        renderPicker(store)
        if (factorB) {
          el.querySelector('.compare-pick').value = factorB
          loadB(store)
        }
      })
    },
    unmount() {
      if (unsub) unsub()
      if (el) el.innerHTML = ''
      el = unsub = null
      factorB = null
      bRowsById = {}
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/compare.test.js`
Expected: PASS — both tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/panels/compare.js test/compare.test.js
git commit -m "feat: add compare panel with side-by-side factor table"
```

---

## Task 15: Polish — error banner, no-data legend, full verification

**Files:**
- Modify: `src/main.js`, `src/shell/shell.css`
- Create: `src/shell/error-banner.js`
- Test: `test/error-banner.test.js`

Adds the non-blocking API-failure banner from the spec ("Couldn't load {factor} — retry"), keeping the last good map visible. No-data legend/color already shipped in Task 8; this task confirms it end-to-end.

- [ ] **Step 1: Write the failing test**

`test/error-banner.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { createStore } from '../src/store/store.js'
import { mountErrorBanner } from '../src/shell/error-banner.js'
import { FACTORS } from '../src/data/factors.js'

const base = {
  factor: 'median_income', geoLevel: 'nation', selectedState: null,
  hoveredId: null, pinnedId: null,
  dataset: { status: 'ready', factor: 'median_income', geoLevel: 'nation',
    rows: [], byId: {}, values: {}, extent: [null, null], error: null }
}

describe('mountErrorBanner', () => {
  it('is hidden while status is not error', () => {
    const el = document.createElement('div')
    mountErrorBanner(el, createStore(base), FACTORS)
    expect(el.querySelector('.error-banner').classList.contains('hidden')).toBe(true)
  })

  it('shows a factor-named message on error and a retry button', () => {
    const el = document.createElement('div')
    const store = createStore(base)
    mountErrorBanner(el, store, FACTORS)
    store.setState({ dataset: { ...base.dataset, status: 'error', error: 'boom' } })
    const banner = el.querySelector('.error-banner')
    expect(banner.classList.contains('hidden')).toBe(false)
    expect(banner.textContent).toContain('Median income')
    expect(el.querySelector('.error-retry')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/error-banner.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

`src/shell/error-banner.js`:

```js
export function mountErrorBanner(el, store, factors) {
  el.innerHTML =
    '<div class="error-banner hidden"><span class="error-text"></span>' +
    '<button class="error-retry">Retry</button></div>'
  const banner = el.querySelector('.error-banner')
  const text = el.querySelector('.error-text')

  el.querySelector('.error-retry').addEventListener('click', () => {
    // Nudge the controller to refetch by clearing then re-setting the factor.
    const { factor } = store.getState()
    store.setState({ factor: null })
    store.setState({ factor })
  })

  store.subscribe((state) => {
    const isError = state.dataset.status === 'error'
    banner.classList.toggle('hidden', !isError)
    if (isError) {
      const label = factors[state.factor]?.label ?? state.factor
      text.textContent = `Couldn't load ${label} — `
    }
  })
}
```

- [ ] **Step 4: Wire the banner into `main.js` and add styles**

In `src/main.js`, after `createShell(...)` and before `createMap(...)`, insert a banner host and mount it:

```js
import { mountErrorBanner } from './shell/error-banner.js'
// ...
const bannerHost = document.createElement('div')
document.getElementById('app').prepend(bannerHost)
mountErrorBanner(bannerHost, store, FACTORS)
```

Append to `src/shell/shell.css`:

```css
.error-banner { background: #fde8e8; color: #922; padding: 8px 12px; display: flex;
  align-items: center; gap: 8px; border-bottom: 1px solid #f3caca; }
.error-banner.hidden { display: none; }
.error-retry { background: #922; color: #fff; border: none; border-radius: 5px;
  padding: 4px 10px; cursor: pointer; }
```

- [ ] **Step 5: Run the retry test and full suite**

Run: `npx vitest run test/error-banner.test.js && npm test`
Expected: PASS — banner tests pass; entire suite green.

- [ ] **Step 6: Manual end-to-end verification**

Run: `npm run dev`
Verify against the spec:
- Switch among all factors; map + legend + ranking update.
- Zoom into a state; counties recolor; Back returns to nation.
- Hover/click updates Details; pinned area persists in Details.
- Compare tab: pick a second factor; side-by-side table fills.
- Search a state name; map zooms to it.
- Simulate API failure (temporarily point `BASE` in `dataUsaClient.js` at a bad URL): banner appears, last good map stays visible, Retry restores it. Revert the URL.

- [ ] **Step 7: Commit**

```bash
git add src/shell/error-banner.js src/main.js src/shell/shell.css test/error-banner.test.js
git commit -m "feat: add non-blocking API error banner with retry"
```

---

## Deferred (not in this plan)

- Time-trend year slider (`panels/trends`).
- US Census Bureau API adapter (tract-level data) — drops in behind the `fetchFactor` interface.
- Bivariate / dual-map rendering for Compare (builds on Task 14's transform seam).
- World/international scope.

## Self-Review Notes

- **Spec coverage:** factors (Task 3), Data USA client behind an interface (Task 4), FIPS join with explicit no-data (Task 5), TopoJSON states→counties (Task 6), store-driven data flow (Task 7), choropleth + zoom + legend + hover/click (Task 8), collapsible two-rail shell with factor picker and tabs matching the mockup (Task 9), ranking/details/compare/search panels (Tasks 11–14), in-memory caching (Task 4 client), API-failure banner + no-data color (Tasks 8, 15). Vitest units cover store, join, client, geo, controller, and each panel's transform (spec's Testing section). Deferred items match the spec's Deferred list.
- **Frozen contract:** the Store Contract section is the single interface Phase-2 tasks build against; no panel imports another panel.
