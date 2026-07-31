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
    expect(client.fetchFactor).toHaveBeenCalledWith(expect.objectContaining({
      variable: 'B01003_001E', dataset: 'acs/acs5', geoLevel: 'nation'
    }))
  })

  it('publishes the second factor to store.compare and clears it on unmount', async () => {
    const el = document.createElement('div')
    const store = createStore(state)
    const bRows = [{ id: '01', name: 'Alabama', value: 5024279 }]
    const client = { fetchFactor: vi.fn(() => Promise.resolve(bRows)) }
    const panel = createComparePanel({ client })
    panel.mount(el, store)

    const pick = el.querySelector('.compare-pick')
    pick.value = 'population'
    pick.dispatchEvent(new Event('change', { bubbles: true }))

    await vi.waitFor(() => expect(store.getState().compare).toBeTruthy())
    expect(store.getState().compare.factor).toBe('population')
    expect(store.getState().compare.valuesById['01']).toBe(5024279)

    panel.unmount()
    expect(store.getState().compare).toBe(null)
  })

  it('draws a scatter dot per area with a Pearson r readout', async () => {
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

    await vi.waitFor(() => expect(el.querySelector('.compare-scatter circle.dot')).toBeTruthy())
    expect(el.querySelectorAll('.compare-scatter circle.dot').length).toBe(2)
    expect(el.querySelector('.r-readout').textContent).toContain('r =')
  })

  it('highlights the scatter dot matching store.hoveredId', async () => {
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
    await vi.waitFor(() => expect(el.querySelector('.compare-scatter circle.dot')).toBeTruthy())

    store.setState({ hoveredId: '02' })
    const hi = el.querySelectorAll('.compare-scatter circle.dot.hi')
    expect(hi.length).toBe(1)
    expect(hi[0].getAttribute('data-id')).toBe('02')
  })
})
