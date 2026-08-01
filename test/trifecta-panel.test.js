import { describe, it, expect, vi } from 'vitest'
import { createStore } from '../src/store/store.js'
import { createTrifectaPanel } from '../src/panels/trifecta.js'
import trifectaData from '../src/data/trifectas.json'

// A minimal five-state world spanning all three groups: TX/MS (R), CA/NY (D), PA (divided).
const POVERTY = {
  '48': 14, '28': 19, // Republican trifectas
  '06': 12, '36': 14, // Democratic trifectas
  '42': 12 // divided
}
const POP = {
  '48': 29_000_000, '28': 3_000_000,
  '06': 39_000_000, '36': 20_000_000,
  '42': 13_000_000
}

const rowsFrom = (map) => Object.entries(map).map(([id, value]) => ({ id, name: id, value }))

// The panel fetches the chosen factor and population; route by the requested variable.
const clientStub = () => ({
  fetchFactor: vi.fn(({ variable }) =>
    Promise.resolve(rowsFrom(variable === 'B01003_001E' ? POP : POVERTY))
  )
})

const baseState = {
  factor: 'trifecta', geoLevel: 'nation', selectedState: null, year: 2023,
  hoveredId: null, pinnedId: null,
  dataset: { status: 'ready', factor: 'trifecta', values: {}, extent: [null, null] }
}

describe('createTrifectaPanel', () => {
  it('groups states by trifecta and reports a population-weighted gap', async () => {
    const el = document.createElement('div')
    createTrifectaPanel({ client: clientStub(), trifectaData }).mount(el, createStore(baseState))

    await vi.waitFor(() => expect(el.querySelector('.tf-headline').textContent).toContain('%'))

    const headline = el.querySelector('.tf-headline').textContent
    expect(headline).toContain('Republican') // 14.5% (weighted) > 12.7% for D
    // R weighted poverty = (14*29 + 19*3) / 32 = 14.5%
    expect(el.querySelector('.tf-group .tf-center').textContent).toBe('14.5%')
    // Only states with a value count toward n (2 Republican, 2 Democratic, 1 divided).
    const counts = [...el.querySelectorAll('.tf-n')].map((n) => n.textContent)
    expect(counts).toEqual(['2 states', '1 states', '2 states'])
    expect(el.querySelector('.tf-region-table')).toBeTruthy()
  })

  it('recomputes unweighted when the weight toggle is unchecked', async () => {
    const el = document.createElement('div')
    createTrifectaPanel({ client: clientStub(), trifectaData }).mount(el, createStore(baseState))
    await vi.waitFor(() => expect(el.querySelector('.tf-center')).toBeTruthy())

    const toggle = el.querySelector('.tf-weight')
    toggle.checked = false
    toggle.dispatchEvent(new Event('change', { bubbles: true }))

    // Unweighted Republican poverty = (14 + 19) / 2 = 16.5%
    expect(el.querySelector('.tf-group .tf-center').textContent).toBe('16.5%')
  })
})
