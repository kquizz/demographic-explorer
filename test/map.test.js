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
