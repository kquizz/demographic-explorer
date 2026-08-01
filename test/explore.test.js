import { describe, it, expect, vi } from 'vitest'
import { createStore } from '../src/store/store.js'
import { createExplorePanel } from '../src/panels/explore.js'

const baseState = {
  factor: 'median_income', geoLevel: 'nation', selectedState: null, year: 2023,
  electionYear: 2024, hoveredId: null, pinnedId: null,
  dataset: { status: 'ready', factor: 'median_income', geoLevel: 'nation',
    rows: [], byId: {}, values: {}, extent: [null, null], error: null }
}

const geo = { featureIds: () => ['01', '02', '03', '04'] }

// Census factors: a rising series for everything, falling for the profile (poverty).
const rising = [
  { id: '01', name: 'A', value: 1 }, { id: '02', name: 'B', value: 2 },
  { id: '03', name: 'C', value: 3 }, { id: '04', name: 'D', value: 4 }
]
const client = {
  fetchFactor: vi.fn((args) =>
    Promise.resolve(
      args.dataset === 'acs/acs5/profile' ? rising.map((r) => ({ ...r, value: 5 - r.value })) : rising
    )
  )
}

// Bundled lenses: trifecta (two R, two D) and vote margin (spread red→blue).
const sources = {
  trifectas: { fetchFactor: vi.fn(() => Promise.resolve([
    { id: '01', name: 'A', value: 'R' }, { id: '02', name: 'B', value: 'R' },
    { id: '03', name: 'C', value: 'D' }, { id: '04', name: 'D', value: 'D' }
  ])) },
  elections: { fetchFactor: vi.fn(() => Promise.resolve([
    { id: '01', name: 'A', value: -40 }, { id: '02', name: 'B', value: -10 },
    { id: '03', name: 'C', value: 10 }, { id: '04', name: 'D', value: 40 }
  ])) },
  laus: { fetchFactor: vi.fn(() => Promise.resolve(rising)) },
  wages: { fetchFactor: vi.fn(() => Promise.resolve(rising)) },
  health: { fetchFactor: vi.fn(() => Promise.resolve(rising)) }
}

const mountPanel = (state) => {
  const el = document.createElement('div')
  createExplorePanel({ client, geo, sources }).mount(el, createStore(state))
  return el
}

describe('createExplorePanel', () => {
  it('defaults to the trifecta lens and renders grouped charts', async () => {
    const el = mountPanel(baseState)
    await vi.waitFor(() => expect(el.querySelector('.mini-chart')).toBeTruthy())

    expect(el.querySelector('.lens-select').value).toBe('trifecta')
    const charts = [...el.querySelectorAll('.mini-chart')]
    expect(charts.length).toBeGreaterThan(3)
    expect(charts.every((c) => c.dataset.mode === 'grouped')).toBe(true)
    // Grouped charts report the D−R gap and draw the party columns.
    expect(el.querySelector('.mini-stat').textContent).toContain('D−R')
    expect(el.querySelector('.mini-cat')).toBeTruthy()
  })

  it('switches to scatter charts with an r readout for a continuous lens', async () => {
    const el = mountPanel(baseState)
    await vi.waitFor(() => expect(el.querySelector('.mini-chart')).toBeTruthy())

    const select = el.querySelector('.lens-select')
    select.value = 'vote_margin'
    select.dispatchEvent(new Event('change'))
    await vi.waitFor(() =>
      expect(el.querySelector('.mini-chart')?.dataset.mode).toBe('scatter')
    )
    expect(el.querySelector('.mini-stat').textContent).toContain('r =')
    // A best-fit line is drawn on the scatter charts.
    expect(el.querySelector('.mini-fit')).toBeTruthy()
  })

  it('never charts the lens against itself', async () => {
    const el = mountPanel(baseState)
    await vi.waitFor(() => expect(el.querySelector('.mini-chart')).toBeTruthy())
    const select = el.querySelector('.lens-select')
    select.value = 'median_income'
    select.dispatchEvent(new Event('change'))
    await vi.waitFor(() =>
      expect(el.querySelector('.mini-chart')?.dataset.mode).toBe('scatter')
    )
    const factors = [...el.querySelectorAll('.mini-chart')].map((c) => c.dataset.factor)
    expect(factors).not.toContain('median_income')
  })
})
