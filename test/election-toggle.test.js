import { describe, it, expect } from 'vitest'
import { createStore } from '../src/store/store.js'
import { mountElectionYearToggle } from '../src/shell/election-toggle.js'

const initial = () => createStore({ factor: 'vote_margin', electionYear: 2024, dataset: { status: 'idle' } })

describe('mountElectionYearToggle', () => {
  it('renders a button per election year and marks the current one', () => {
    const el = document.createElement('div')
    mountElectionYearToggle(el, initial(), [2020, 2024])
    const buttons = [...el.querySelectorAll('.election-year')]
    expect(buttons.map((b) => b.textContent)).toEqual(['2020', '2024'])
    expect(el.querySelector('.election-year.on').dataset.year).toBe('2024')
  })

  it('writes the chosen election year to the store on click', () => {
    const el = document.createElement('div')
    const store = initial()
    mountElectionYearToggle(el, store, [2020, 2024])
    el.querySelector('.election-year[data-year="2020"]').dispatchEvent(new Event('click', { bubbles: true }))
    expect(store.getState().electionYear).toBe(2020)
    expect(el.querySelector('.election-year.on').dataset.year).toBe('2020')
  })
})
