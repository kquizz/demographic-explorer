import { describe, it, expect, vi } from 'vitest'
import { createStore } from '../src/store/store.js'
import { createDetailsPanel } from '../src/panels/details.js'

const state = {
  factor: 'median_income', geoLevel: 'nation', selectedState: null, year: 2023,
  hoveredId: null, pinnedId: null,
  dataset: {
    status: 'ready', factor: 'median_income', geoLevel: 'nation', rows: [],
    byId: { '01': { id: '01', name: 'Alabama', value: 54943 } },
    values: { '01': 54943, '02': null }, extent: [54943, 80287], error: null
  }
}

// A stub census client returning a rising median-income series for Alabama ('01').
const YEARS = [2020, 2021, 2022, 2023]
const seriesByYear = {
  2020: [{ id: '01', name: 'Alabama', value: 50000 }],
  2021: [{ id: '01', name: 'Alabama', value: 52000 }],
  2022: [{ id: '01', name: 'Alabama', value: 54000 }],
  2023: [{ id: '01', name: 'Alabama', value: 54943 }]
}
const stubClient = () => ({
  fetchFactor: vi.fn(({ year }) => Promise.resolve(seriesByYear[year] ?? []))
})
const panel = () => createDetailsPanel({ client: stubClient(), years: YEARS })

describe('createDetailsPanel', () => {
  it('prompts when nothing is hovered or pinned', () => {
    const el = document.createElement('div')
    panel().mount(el, createStore(state))
    expect(el.textContent).toMatch(/hover|select/i)
  })

  it('shows the hovered area name and formatted value', () => {
    const el = document.createElement('div')
    const store = createStore(state)
    panel().mount(el, store)
    store.setState({ hoveredId: '01' })
    expect(el.textContent).toContain('Alabama')
    expect(el.textContent).toContain('$54,943')
  })

  it('prefers pinnedId over hoveredId', () => {
    const el = document.createElement('div')
    const store = createStore({ ...state, hoveredId: '02', pinnedId: '01' })
    panel().mount(el, store)
    expect(el.textContent).toContain('Alabama')
  })

  it('shows No data for an id absent from byId', () => {
    const el = document.createElement('div')
    const store = createStore(state)
    panel().mount(el, store)
    store.setState({ hoveredId: '02' })
    expect(el.textContent).toMatch(/no data/i)
  })

  it('draws a sparkline of the selected area trend with a first→last change', async () => {
    const el = document.createElement('div')
    const store = createStore(state)
    panel().mount(el, store)
    store.setState({ pinnedId: '01' })
    await vi.waitFor(() => expect(el.querySelector('.spark-line')).toBeTruthy())
    const pts = el.querySelector('.spark-line').getAttribute('points').trim().split(' ')
    expect(pts.length).toBe(4) // one point per year in the series
    expect(el.querySelector('.spark-change').textContent).toBe('2020→2023: +$4,943')
  })

  it('does not draw a sparkline for an election factor', async () => {
    const el = document.createElement('div')
    const store = createStore({ ...state, factor: 'vote_margin' })
    panel().mount(el, store)
    store.setState({ pinnedId: '01' })
    // give any (incorrect) async load a chance to resolve, then assert nothing drew
    await Promise.resolve()
    await Promise.resolve()
    expect(el.querySelector('.spark-svg')).toBeNull()
  })
})
