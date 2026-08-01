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

  it('shows a hover tooltip with the area name and value, and hides it on out', () => {
    const el = document.createElement('div')
    const store = createStore(baseState)
    createMap(el, createGeo(topology), store)
    const path = el.querySelector('path.feature[data-id="01"]')
    path.dispatchEvent(new Event('pointerover', { bubbles: true }))
    const tip = el.querySelector('.map-tooltip')
    expect(tip.style.display).toBe('block')
    expect(tip.textContent).toContain('Alabama')
    expect(tip.textContent).toContain('$54,943')
    path.dispatchEvent(new Event('pointerout', { bubbles: true }))
    expect(tip.style.display).toBe('none')
  })

  it('tooltip shows both factor values in compare mode', () => {
    const el = document.createElement('div')
    const store = createStore({
      ...baseState,
      compare: { factor: 'population', valuesById: { '01': 5024279 } }
    })
    createMap(el, createGeo(topology), store)
    el.querySelector('path.feature[data-id="01"]')
      .dispatchEvent(new Event('pointerover', { bubbles: true }))
    const tip = el.querySelector('.map-tooltip').textContent
    expect(tip).toContain('Alabama')
    expect(tip).toContain('Median income')
    expect(tip).toContain('$54,943')
    expect(tip).toContain('Population')
    expect(tip).toContain('5,024,279')
  })

  it('anchors the sequential scale at zero when colorScaling is absolute', () => {
    const el = document.createElement('div')
    const store = createStore({
      ...baseState, colorScaling: 'absolute',
      dataset: {
        status: 'ready', factor: 'median_income', geoLevel: 'nation', rows: [],
        byId: { '01': { id: '01', name: 'Alabama', value: 54943 } },
        values: { '01': 54943, '02': 80287 }, extent: [54943, 80287], error: null
      }
    })
    createMap(el, createGeo(topology), store)
    // Legend low end reads zero, not the data minimum.
    expect(el.querySelector('.legend .lo').textContent).toBe('$0')
    // The minimum-valued feature is no longer the palest shade (it would be under relative).
    const fillAbsolute = el.querySelector('path.feature[data-id="01"]').getAttribute('fill')
    store.setState({ colorScaling: 'relative' })
    const fillRelative = el.querySelector('path.feature[data-id="01"]').getAttribute('fill')
    expect(fillAbsolute).not.toBe(fillRelative)
  })

  it('renders a legend with a no-data swatch', () => {
    const el = document.createElement('div')
    const store = createStore(baseState)
    createMap(el, createGeo(topology), store)
    expect(el.querySelector('.legend')).toBeTruthy()
    expect(el.querySelector('.legend .no-data-swatch')).toBeTruthy()
  })

  it('colors bivariately and shows a 3x3 legend when compare is active', () => {
    const el = document.createElement('div')
    const store = createStore({
      ...baseState,
      compare: { factor: 'population', valuesById: { '01': 1000, '02': 2000 } }
    })
    createMap(el, createGeo(topology), store)
    // both features have data → a bivariate bin tag, not the no-data class
    const f1 = el.querySelector('path.feature[data-id="01"]')
    expect(f1.getAttribute('data-biv')).toMatch(/^[0-2][0-2]$/)
    expect(el.querySelector('.bivariate-legend')).toBeTruthy()
    expect(el.querySelectorAll('.bivariate-legend .biv-cell').length).toBe(9)
    expect(el.querySelector('.biv-axis-a').textContent).toContain('Median income')
    expect(el.querySelector('.biv-axis-b').textContent).toContain('Population')
  })

  it('reverts to the single-factor legend when compare clears', () => {
    const el = document.createElement('div')
    const store = createStore({
      ...baseState,
      compare: { factor: 'population', valuesById: { '01': 1000, '02': 2000 } }
    })
    createMap(el, createGeo(topology), store)
    expect(el.querySelector('.bivariate-legend')).toBeTruthy()
    store.setState({ compare: null })
    expect(el.querySelector('.bivariate-legend')).toBeFalsy()
    expect(el.querySelector('.legend .no-data-swatch')).toBeTruthy()
  })

  it('uses a diverging scale + legend for a diverging factor (vote margin)', () => {
    const el = document.createElement('div')
    const store = createStore({
      ...baseState,
      dataset: {
        status: 'ready', factor: 'vote_margin', geoLevel: 'nation',
        rows: [], byId: {},
        values: { '01': -40, '02': 25 }, extent: [-40, 25], error: null
      }
    })
    createMap(el, createGeo(topology), store)
    expect(el.querySelector('.diverging-legend')).toBeTruthy()
    const rep = el.querySelector('path.feature[data-id="01"]').getAttribute('fill')
    const dem = el.querySelector('path.feature[data-id="02"]').getAttribute('fill')
    // both are colored (not the no-data grey) and the two leans differ
    expect(rep).not.toBe('#e8e8ea')
    expect(dem).not.toBe('#e8e8ea')
    expect(rep).not.toBe(dem)
  })

  it('uses a categorical scale + legend for a categorical factor (trifecta)', () => {
    const el = document.createElement('div')
    const store = createStore({
      ...baseState,
      dataset: {
        status: 'ready', factor: 'trifecta', geoLevel: 'nation',
        rows: [], byId: {},
        values: { '01': 'R', '02': 'D' }, extent: [null, null], error: null
      }
    })
    createMap(el, createGeo(topology), store)
    expect(el.querySelector('.categorical-legend')).toBeTruthy()
    expect(el.querySelectorAll('.categorical-legend .cat-swatch').length).toBe(4)
    expect(el.querySelector('path.feature[data-id="01"]').getAttribute('fill')).toBe('#c1362f')
    expect(el.querySelector('path.feature[data-id="02"]').getAttribute('fill')).toBe('#2f5fc1')
  })
})
