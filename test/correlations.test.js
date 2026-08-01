import { describe, it, expect, vi } from 'vitest'
import { createStore } from '../src/store/store.js'
import { createCorrelationsPanel } from '../src/panels/correlations.js'

const baseState = {
  factor: 'median_income', geoLevel: 'nation', selectedState: null, year: 2023,
  hoveredId: null, pinnedId: null,
  dataset: {
    status: 'ready', factor: 'median_income', geoLevel: 'nation',
    rows: [], byId: {}, values: {}, extent: [null, null], error: null
  }
}

// Scoping keeps only areas on screen; the mock geo puts three areas on screen.
const geo = { featureIds: () => ['01', '02', '03'] }

// The census mock returns a rising series for every factor, but a falling one for the
// profile (poverty) dataset — so poverty correlates -1 with the current factor and the
// rest +1.
const rows = [{ id: '01', value: 1 }, { id: '02', value: 2 }, { id: '03', value: 3 }]
const client = {
  fetchFactor: vi.fn((args) =>
    Promise.resolve(
      args.dataset === 'acs/acs5/profile' ? rows.map((r) => ({ ...r, value: 4 - r.value })) : rows
    )
  )
}

// Bundled numeric layers: unemployment (BLS) falls, wages/life expectancy rise — so
// unemployment runs opposite a rising census factor and the others run with it.
const falling = [{ id: '01', value: 6 }, { id: '02', value: 5 }, { id: '03', value: 4 }]
const sources = {
  laus: { fetchFactor: vi.fn(() => Promise.resolve(falling)) },
  wages: { fetchFactor: vi.fn(() => Promise.resolve(rows)) },
  health: { fetchFactor: vi.fn(() => Promise.resolve(rows)) }
}

describe('createCorrelationsPanel', () => {
  it('ranks other factors by correlation with the current census factor', async () => {
    const el = document.createElement('div')
    createCorrelationsPanel({ client, geo, sources }).mount(el, createStore(baseState))
    await vi.waitFor(() => expect(el.querySelector('.corr-row')).toBeTruthy())

    expect(el.querySelector('.corr-head').textContent).toContain('Median income')
    const text = el.querySelector('.corr-list').textContent
    expect(text).toContain('Population') // a perfectly-correlated factor is listed
    expect(text).toContain('+1.00')
    expect(text).toContain('−1.00') // poverty (profile dataset) runs the other way
    // the current factor is never correlated against itself
    const names = [...el.querySelectorAll('.corr-name')].map((n) => n.textContent)
    expect(names).not.toContain('Median income')
  })

  it('includes the bundled numeric layers in the ranking', async () => {
    const el = document.createElement('div')
    createCorrelationsPanel({ client, geo, sources }).mount(el, createStore(baseState))
    await vi.waitFor(() => expect(el.querySelector('.corr-row')).toBeTruthy())

    const names = [...el.querySelectorAll('.corr-name')].map((n) => n.textContent)
    expect(names).toContain('Avg annual pay (BLS)')
    expect(names).toContain('Unemployment rate (BLS)')
    expect(names).toContain('Life expectancy (yrs)')
    // BLS unemployment (falling) runs opposite the rising census base factor.
    const unemp = [...el.querySelectorAll('.corr-row')].find((r) =>
      r.querySelector('.corr-name').textContent === 'Unemployment rate (BLS)'
    )
    expect(unemp.querySelector('.corr-r').textContent).toBe('−1.00')
  })

  it('can use a bundled source as the base factor', async () => {
    const el = document.createElement('div')
    createCorrelationsPanel({ client, geo, sources })
      .mount(el, createStore({ ...baseState, factor: 'laus_unemployment' }))
    await vi.waitFor(() => expect(el.querySelector('.corr-row')).toBeTruthy())

    expect(el.querySelector('.corr-head').textContent).toContain('Unemployment rate (BLS)')
    const names = [...el.querySelectorAll('.corr-name')].map((n) => n.textContent)
    expect(names).toContain('Median income') // census factors correlate against the layer
    expect(names).not.toContain('Unemployment rate (BLS)') // never against itself
  })

  it('prompts for a numeric factor when the current one is categorical/diverging', async () => {
    const el = document.createElement('div')
    createCorrelationsPanel({ client, geo, sources })
      .mount(el, createStore({ ...baseState, factor: 'trifecta' }))
    await vi.waitFor(() => expect(el.querySelector('.corr-empty')).toBeTruthy())
    expect(el.querySelector('.corr-empty').textContent).toContain('numeric factor')
  })
})
