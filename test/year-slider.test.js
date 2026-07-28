import { describe, it, expect } from 'vitest'
import { createStore } from '../src/store/store.js'
import { mountYearSlider } from '../src/shell/year-slider.js'

const years = [2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023]

const initial = () => createStore({ factor: 'median_income', year: 2023, dataset: { status: 'idle' } })

describe('mountYearSlider', () => {
  it('renders a range input bounded by the year list and shows the current year', () => {
    const el = document.createElement('div')
    mountYearSlider(el, initial(), years)
    const input = el.querySelector('.year-input')
    expect(input.min).toBe('2012')
    expect(input.max).toBe('2023')
    expect(input.value).toBe('2023')
    expect(el.querySelector('.year-value').textContent).toBe('2023')
  })

  it('writes the selected year to the store on input', () => {
    const el = document.createElement('div')
    const store = initial()
    mountYearSlider(el, store, years)
    const input = el.querySelector('.year-input')
    input.value = '2015'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    expect(store.getState().year).toBe(2015)
  })

  it('reflects year changes made elsewhere in the store', () => {
    const el = document.createElement('div')
    const store = initial()
    mountYearSlider(el, store, years)
    store.setState({ year: 2018 })
    expect(el.querySelector('.year-input').value).toBe('2018')
    expect(el.querySelector('.year-value').textContent).toBe('2018')
  })
})
