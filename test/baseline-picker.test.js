import { describe, it, expect } from 'vitest'
import { createStore } from '../src/store/store.js'
import { mountBaselinePicker } from '../src/shell/baseline-picker.js'

const YEARS = [2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023]

describe('mountBaselinePicker', () => {
  it('leaves baselineYear null and the select disabled until checked', () => {
    const el = document.createElement('div')
    const store = createStore({ baselineYear: null })
    mountBaselinePicker(el, store, YEARS)
    expect(el.querySelector('.baseline-year').disabled).toBe(true)
    expect(store.getState().baselineYear).toBe(null)
  })

  it('sets baselineYear to the selected year when checked, and clears it when unchecked', () => {
    const el = document.createElement('div')
    const store = createStore({ baselineYear: null })
    mountBaselinePicker(el, store, YEARS)
    const cb = el.querySelector('.baseline-on')
    const sel = el.querySelector('.baseline-year')

    cb.checked = true
    cb.dispatchEvent(new Event('change', { bubbles: true }))
    expect(sel.disabled).toBe(false)
    expect(store.getState().baselineYear).toBe(2012) // earliest is the default

    sel.value = '2018'
    sel.dispatchEvent(new Event('change', { bubbles: true }))
    expect(store.getState().baselineYear).toBe(2018)

    cb.checked = false
    cb.dispatchEvent(new Event('change', { bubbles: true }))
    expect(store.getState().baselineYear).toBe(null)
  })
})
