import { describe, it, expect, vi } from 'vitest'
import { createStore } from '../src/store/store.js'
import { createShell } from '../src/shell/shell.js'

const factorList = [
  { id: 'median_income', label: 'Median income' },
  { id: 'population', label: 'Population' }
]

const makePanel = (id) => ({
  id, label: id, mount: vi.fn(), unmount: vi.fn()
})

const initial = { factor: 'median_income', geoLevel: 'nation', selectedState: null,
  hoveredId: null, pinnedId: null, dataset: { status: 'idle' } }

describe('createShell', () => {
  it('renders map, search, and factor-rail slots', () => {
    const el = document.createElement('div')
    createShell(el, createStore(initial), { factorList, panels: [makePanel('ranking')] })
    expect(el.querySelector('#map-slot')).toBeTruthy()
    expect(el.querySelector('#search-slot')).toBeTruthy()
    expect(el.querySelectorAll('.factor-pill').length).toBe(2)
  })

  it('renders a footer citing the Census and election data sources', () => {
    const el = document.createElement('div')
    createShell(el, createStore(initial), { factorList, panels: [makePanel('ranking')] })
    const footer = el.querySelector('.appfooter')
    expect(footer).toBeTruthy()
    expect(footer.textContent).toMatch(/census/i)
    expect(footer.querySelectorAll('a').length).toBeGreaterThanOrEqual(2)
  })

  it('marks the active factor pill and sets factor on click', () => {
    const el = document.createElement('div')
    const store = createStore(initial)
    createShell(el, store, { factorList, panels: [makePanel('ranking')] })
    const pop = el.querySelector('.factor-pill[data-id="population"]')
    pop.dispatchEvent(new Event('click', { bubbles: true }))
    expect(store.getState().factor).toBe('population')
    expect(el.querySelector('.factor-pill.on[data-id="population"]')).toBeTruthy()
  })

  it('mounts the first panel and switches on tab click', () => {
    const el = document.createElement('div')
    const store = createStore(initial)
    const ranking = makePanel('ranking')
    const details = makePanel('details')
    createShell(el, store, { factorList, panels: [ranking, details] })
    expect(ranking.mount).toHaveBeenCalledTimes(1)
    el.querySelector('.tab[data-id="details"]').dispatchEvent(new Event('click', { bubbles: true }))
    expect(ranking.unmount).toHaveBeenCalledTimes(1)
    expect(details.mount).toHaveBeenCalledTimes(1)
  })

  it('collapses a rail when its toggle is clicked', () => {
    const el = document.createElement('div')
    createShell(el, createStore(initial), { factorList, panels: [makePanel('ranking')] })
    const rail = el.querySelector('.rail-left')
    el.querySelector('.rail-left .collapse-toggle').dispatchEvent(new Event('click', { bubbles: true }))
    expect(rail.classList.contains('collapsed')).toBe(true)
  })
})
