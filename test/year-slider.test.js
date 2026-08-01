import { describe, it, expect, vi, afterEach } from 'vitest'
import { createStore } from '../src/store/store.js'
import { mountYearSlider } from '../src/shell/year-slider.js'

const years = [2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023]

afterEach(() => vi.useRealTimers())

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

  it('plays through the years and loops at the end', () => {
    vi.useFakeTimers()
    const el = document.createElement('div')
    const store = createStore({ factor: 'median_income', year: 2022, dataset: { status: 'idle' } })
    mountYearSlider(el, store, years)
    const play = el.querySelector('.year-play')

    play.click()
    expect(play.classList.contains('on')).toBe(true)
    vi.advanceTimersByTime(900)
    expect(store.getState().year).toBe(2023)
    vi.advanceTimersByTime(900)
    expect(store.getState().year).toBe(2012) // looped back to the start
  })

  it('pauses, and manual scrubbing halts playback', () => {
    vi.useFakeTimers()
    const el = document.createElement('div')
    const store = createStore({ factor: 'median_income', year: 2015, dataset: { status: 'idle' } })
    mountYearSlider(el, store, years)
    const play = el.querySelector('.year-play')
    const input = el.querySelector('.year-input')

    play.click()
    vi.advanceTimersByTime(900)
    expect(store.getState().year).toBe(2016)
    play.click() // pause
    expect(play.classList.contains('on')).toBe(false)
    vi.advanceTimersByTime(3000)
    expect(store.getState().year).toBe(2016) // frozen while paused

    play.click() // play again
    input.value = '2019'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    expect(store.getState().year).toBe(2019)
    expect(play.classList.contains('on')).toBe(false) // scrubbing stopped playback
    vi.advanceTimersByTime(3000)
    expect(store.getState().year).toBe(2019)
  })
})
