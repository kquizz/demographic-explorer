import us from 'us-atlas/counties-10m.json'
import './shell/shell.css'
import { createStore } from './store/store.js'
import { createGeo } from './map/geo.js'
import { createCensusClient } from './data/censusClient.js'
import { createDataController } from './data/controller.js'
import { createMap } from './map/map.js'
import { createShell } from './shell/shell.js'
import { FACTOR_LIST, FACTORS } from './data/factors.js'
import { createRankingPanel } from './panels/ranking.js'
import { createDetailsPanel } from './panels/details.js'
import { createComparePanel } from './panels/compare.js'
import { mountSearch } from './search/search.js'
import { mountErrorBanner } from './shell/error-banner.js'
import { mountYearSlider } from './shell/year-slider.js'

// ACS 5-year vintages where all factors resolve cleanly (B15003 education starts 2012).
const YEARS = [2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023]
const LATEST_YEAR = YEARS[YEARS.length - 1]

const store = createStore({
  factor: null, geoLevel: 'nation', selectedState: null, year: LATEST_YEAR,
  hoveredId: null, pinnedId: null,
  dataset: { status: 'idle', factor: null, geoLevel: null, rows: [], byId: {},
    values: {}, extent: [null, null], error: null }
})

const geo = createGeo(us)
const client = createCensusClient({ key: import.meta.env.VITE_CENSUS_KEY })
createDataController(store, client, geo, FACTORS)

const panels = [createRankingPanel(), createDetailsPanel(), createComparePanel({ client })]
const app = document.getElementById('app')
const { mapSlot, searchSlot, yearSlot } = createShell(app, store, { factorList: FACTOR_LIST, panels })

const bannerHost = document.createElement('div')
app.prepend(bannerHost)
mountErrorBanner(bannerHost, store, FACTORS)

createMap(mapSlot, geo, store)
mountSearch(searchSlot, store, geo)
mountYearSlider(yearSlot, store, YEARS)

store.setState({ factor: 'median_income' })
