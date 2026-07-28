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
