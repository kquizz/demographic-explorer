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
