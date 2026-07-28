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
