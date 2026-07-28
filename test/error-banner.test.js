import { describe, it, expect } from 'vitest'
import { createStore } from '../src/store/store.js'
import { mountErrorBanner } from '../src/shell/error-banner.js'
import { FACTORS } from '../src/data/factors.js'

const base = {
  factor: 'median_income', geoLevel: 'nation', selectedState: null,
  hoveredId: null, pinnedId: null,
  dataset: { status: 'ready', factor: 'median_income', geoLevel: 'nation',
    rows: [], byId: {}, values: {}, extent: [null, null], error: null }
}

describe('mountErrorBanner', () => {
  it('is hidden while status is not error', () => {
    const el = document.createElement('div')
    mountErrorBanner(el, createStore(base), FACTORS)
    expect(el.querySelector('.error-banner').classList.contains('hidden')).toBe(true)
  })

  it('shows a factor-named message on error and a retry button', () => {
    const el = document.createElement('div')
    const store = createStore(base)
    mountErrorBanner(el, store, FACTORS)
    store.setState({ dataset: { ...base.dataset, status: 'error', error: 'boom' } })
    const banner = el.querySelector('.error-banner')
    expect(banner.classList.contains('hidden')).toBe(false)
    expect(banner.textContent).toContain('Median income')
    expect(el.querySelector('.error-retry')).toBeTruthy()
  })
})
