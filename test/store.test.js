import { describe, it, expect, vi } from 'vitest'
import { createStore } from '../src/store/store.js'

describe('createStore', () => {
  it('returns the initial state from getState', () => {
    const store = createStore({ factor: 'a', geoLevel: 'nation' })
    expect(store.getState()).toEqual({ factor: 'a', geoLevel: 'nation' })
  })

  it('merges partial updates and notifies subscribers', () => {
    const store = createStore({ factor: 'a', hoveredId: null })
    const seen = vi.fn()
    store.subscribe(seen)
    store.setState({ hoveredId: '01' })
    expect(store.getState()).toEqual({ factor: 'a', hoveredId: '01' })
    expect(seen).toHaveBeenCalledTimes(1)
    expect(seen).toHaveBeenCalledWith(store.getState())
  })

  it('does not notify when setState changes nothing', () => {
    const store = createStore({ factor: 'a' })
    const seen = vi.fn()
    store.subscribe(seen)
    store.setState({ factor: 'a' })
    expect(seen).not.toHaveBeenCalled()
  })

  it('stops notifying after unsubscribe', () => {
    const store = createStore({ n: 0 })
    const seen = vi.fn()
    const off = store.subscribe(seen)
    off()
    store.setState({ n: 1 })
    expect(seen).not.toHaveBeenCalled()
  })
})
