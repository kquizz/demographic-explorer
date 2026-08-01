import us from 'us-atlas/counties-10m.json'
import electionData from './data/elections.json'
import trifectaData from './data/trifectas.json'
import lausData from './data/laus.json'
import wageData from './data/wages.json'
import healthData from './data/health.json'
import './shell/shell.css'
import { createStore } from './store/store.js'
import { createGeo } from './map/geo.js'
import { createCensusClient } from './data/censusClient.js'
import { createElectionsSource } from './data/electionsSource.js'
import { createTrifectasSource } from './data/trifectasSource.js'
import { createFipsYearSource } from './data/fipsYearSource.js'
import { createDataController } from './data/controller.js'
import { createMap } from './map/map.js'
import { createShell } from './shell/shell.js'
import { FACTOR_LIST, FACTORS } from './data/factors.js'
import { createRankingPanel } from './panels/ranking.js'
import { createDetailsPanel } from './panels/details.js'
import { createComparePanel } from './panels/compare.js'
import { createCorrelationsPanel } from './panels/correlations.js'
import { createTrifectaPanel } from './panels/trifecta.js'
import { mountSearch } from './search/search.js'
import { mountErrorBanner } from './shell/error-banner.js'
import { mountYearSlider } from './shell/year-slider.js'
import { mountBaselinePicker } from './shell/baseline-picker.js'
import { mountElectionYearToggle } from './shell/election-toggle.js'
import { mountColorScaleToggle } from './shell/color-scale-toggle.js'

// ACS 5-year vintages where all factors resolve cleanly (B15003 education starts 2012).
const YEARS = [2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023]
const LATEST_YEAR = YEARS[YEARS.length - 1]
const ELECTION_YEARS = [2020, 2024]

const store = createStore({
  factor: null, geoLevel: 'nation', selectedState: null,
  year: LATEST_YEAR, electionYear: 2024, baselineYear: null, colorScaling: 'relative',
  hoveredId: null, pinnedId: null, compare: null,
  dataset: { status: 'idle', factor: null, geoLevel: null, rows: [], byId: {},
    values: {}, extent: [null, null], error: null }
})

const geo = createGeo(us)
const client = createCensusClient({ key: import.meta.env.VITE_CENSUS_KEY })
const elections = createElectionsSource(electionData)
const trifectas = createTrifectasSource(trifectaData, geo)
const laus = createFipsYearSource(lausData)
const wages = createFipsYearSource(wageData)
const health = createFipsYearSource(healthData)
const sources = { elections, trifectas, laus, wages, health }
createDataController(store, client, geo, FACTORS, sources)

const panels = [
  createRankingPanel(),
  createDetailsPanel({ client, years: YEARS }),
  createComparePanel({ client }),
  createCorrelationsPanel({ client, geo, sources }),
  createTrifectaPanel({ client, trifectaData })
]
const app = document.getElementById('app')
const { mapSlot, searchSlot, yearSlot } = createShell(app, store, { factorList: FACTOR_LIST, panels })

const bannerHost = document.createElement('div')
app.prepend(bannerHost)
mountErrorBanner(bannerHost, store, FACTORS)

createMap(mapSlot, geo, store)
mountSearch(searchSlot, store, geo)

// The ACS year slider and the election-year toggle share the header slot; show whichever
// matches the active factor's data source.
const acsWrap = document.createElement('span')
const elecWrap = document.createElement('span')
elecWrap.style.display = 'none'
yearSlot.append(acsWrap, elecWrap)
mountYearSlider(acsWrap, store, YEARS)
const baselineWrap = document.createElement('span')
baselineWrap.className = 'baseline-wrap'
acsWrap.append(baselineWrap)
mountBaselinePicker(baselineWrap, store, YEARS)
mountElectionYearToggle(elecWrap, store, ELECTION_YEARS)
// The shade-anchor toggle only applies to single-factor sequential maps, so hide it for
// election (diverging), trifecta (categorical) and delta (diverging) views.
const colorWrap = document.createElement('span')
colorWrap.className = 'color-scale-wrap'
yearSlot.prepend(colorWrap)
mountColorScaleToggle(colorWrap, store)
store.subscribe((s) => {
  const f = FACTORS[s.factor]
  const isElection = f?.source === 'elections'
  const isSwing = f?.metric === 'swing' // fixed 2020->2024 diff — no time control applies
  acsWrap.style.display = !isElection ? '' : 'none'
  elecWrap.style.display = isElection && !isSwing ? '' : 'none'
  const isDelta = s.baselineYear != null && s.baselineYear !== s.year
  colorWrap.style.display = f && !f.scale && !isElection && !isDelta ? '' : 'none'
})

store.setState({ factor: 'median_income' })
