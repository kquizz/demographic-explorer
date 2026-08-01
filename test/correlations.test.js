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

// The mock returns a rising series for every factor, but a falling one for the profile
// (poverty) dataset — so poverty correlates -1 with the current factor and the rest +1.
const rows = [{ id: '01', value: 1 }, { id: '02', value: 2 }, { id: '03', value: 3 }]
const client = {
  fetchFactor: vi.fn((args) =>
    Promise.resolve(
      args.dataset === 'acs/acs5/profile' ? rows.map((r) => ({ ...r, value: 4 - r.value })) : rows
    )
  )
}

describe('createCorrelationsPanel', () => {
  it('ranks other census factors by correlation with the current factor', async () => {
    const el = document.createElement('div')
    createCorrelationsPanel({ client }).mount(el, createStore(baseState))
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

  it('prompts for a census factor when the current one is a bundled source', async () => {
    const el = document.createElement('div')
    createCorrelationsPanel({ client }).mount(el, createStore({ ...baseState, factor: 'trifecta' }))
    await vi.waitFor(() => expect(el.querySelector('.corr-empty')).toBeTruthy())
    expect(el.querySelector('.corr-empty').textContent).toContain('Census factor')
  })
})
