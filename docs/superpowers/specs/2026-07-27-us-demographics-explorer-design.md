# US Demographics Explorer — Design Spec

**Date:** 2026-07-27
**Status:** Approved (design), pending implementation plan

## Overview

An interactive, US-focused website for exploring and visualizing demographic data on a
D3 choropleth map. Users pick a demographic factor and the map recolors; they can zoom from
states into counties, hover for exact numbers, rank areas, compare two factors, and search
for a specific place. The tool presents neutral, well-sourced Census-derived data — the
defense against any single narrative is transparency and easy multi-factor comparison, not
editorializing.

## Goals

- Quickly switch the map among many demographic factors.
- Drill from nation/state view down into counties.
- Analyze, not just view: ranking, details, and factor comparison.
- Keep the codebase close to D3 and structured so feature work parallelizes cleanly.

## Non-Goals (v1)

- No backend or database — everything runs client-side.
- No world/international scope (US only).
- No user accounts, saved views, or sharing.
- Time-trend slider is deferred (see Deferred).

## Scope

- **Geography:** US, states with zoom into counties (~50 states, ~3,143 counties).
- **Factors (all neutral Census-derived categories):**
  - Population & age (total population, density, median age)
  - Economic (median household income, poverty rate, unemployment)
  - Education (% high school / bachelor's / graduate)
  - Housing (median home value, rent, ownership rate)
  - Diversity / composition (race & ethnicity breakdowns, foreign-born %)
- **Analysis features:** hover/click details, ranking leaderboard, compare mode, search.

## Tech Stack

- **Vanilla JavaScript + D3 v7** — no UI framework; stays close to D3.
- **Vite** — dev server + bundler for clean ES-module imports and fast dev loop; output is a
  static site.
- **TopoJSON** via the `us-atlas` package — states + counties geometry, FIPS-coded.
- **Data USA API** (https://datausa.io/about/api) — primary data source, no API key required,
  JSON, supports Nation → State → County drill-down. A thin client wraps it behind an interface
  so a **US Census Bureau API** (https://www.census.gov/developers/) adapter can be added later
  without touching consumers.
- **Vitest** — unit testing.
- No backend; data fetched client-side and cached in memory.

## Architecture

The system is a set of modules communicating only through a single shared store. No panel
talks to another panel directly.

### Foundation modules (Phase 1 — built first, sequentially)

- **`store`** — single source of truth. State shape:
  `{ factor, geoLevel (nation | state), selectedState, hoveredId, pinnedId }`.
  Plain pub/sub (`subscribe`, `emit`/`set`). Every module reads from it; state changes flow
  one direction.
- **`data/`**
  - `dataUsaClient` — fetch + normalize responses from the Data USA API.
  - `join` — merge a factor's metric values onto TopoJSON features by FIPS code; returns
    `{ featureId → value }`. Handles missing/absent values explicitly.
- **`map/`** — the D3 choropleth. Draws states; zoom into a state renders its counties; owns the
  color scale + legend; emits hover/click as `hoveredId`/`pinnedId` into the store.
- **`shell/`** — the collapsible two-rail layout (per approved mockup): header with search box,
  left rail = factor picker, center = map, right rail = tabbed analysis panel. Each rail
  collapses to a thin strip; collapsing both yields a full-bleed map. Mounts feature panels into
  the right-rail tabs.

### Feature panels (Phase 2 — parallelizable)

Each panel is a self-contained module implementing the same contract:
`mount(el, store)` / `unmount()`. It reads the store and re-renders on change. This uniform
interface is what allows independent, parallel development.

- **`panels/ranking`** — sortable leaderboard for the current factor and geo level.
- **`panels/details`** — full stat sheet for the hovered or pinned area.
- **`panels/compare`** — two-factor comparison (side-by-side maps or a bivariate map); the most
  involved panel.
- **`search`** — jump to a state or county by name; wires into the shell header, writes
  selection into the store.
- **`panels/trends`** *(deferred)* — year slider over factors with historical data.

## Data Flow

1. User picks a factor (or changes geo level) → `store` updates.
2. `data` layer fetches values for the current factor + geo level (or serves them from cache).
3. `join` produces `{ id → value }` keyed by FIPS.
4. `map` recolors and updates the legend; every mounted panel re-reads the store and re-renders.
5. Hover/click on the map writes `hoveredId` / `pinnedId` back to the store; the Details panel
   reflects it.

## Error Handling

- **API failure:** non-blocking banner ("Couldn't load {factor} — retry"); the last good map
  stays visible rather than blanking.
- **Missing county data:** rendered as a distinct "no data" color, shown in the legend — never
  coerced to zero.
- **Caching:** in-memory cache keyed by `factor + geoLevel` so switching factors back and forth
  is instant and avoids redundant API calls.

## Testing

- **Vitest units:**
  - `join` — FIPS matching and missing-data handling.
  - `store` — pub/sub correctness.
  - `dataUsaClient` — normalization against a saved sample API response.
  - Each feature panel — its data transform (e.g., ranking sort/format).
- Map/DOM rendering verified manually in-browser (not worth heavy automation at this size).

## Build Order

1. **Foundation (sequential):** `store` → `data` + `join` → `map` → `shell`. Done when the map
   colors by median income, hovering a county shows its number, and zoom into a state works.
2. **Fan out (parallel):** `ranking`, `details`, `compare`, `search` as independent modules
   against the frozen `store` contract.
3. **Polish:** legend/color-scale refinement, empty/error states.

## Deferred

- Time-trend year slider (`panels/trends`).
- US Census Bureau API adapter (richer, tract-level data).
- World/international scope.

## Data Sources (reference)

- Data USA API — https://datausa.io/about/api
- US Census Bureau Developer API — https://www.census.gov/developers/
- us-atlas (TopoJSON US states + counties) — https://github.com/topojson/us-atlas
- World Atlas / Natural Earth / MapShaper — for any custom geometry needs.
