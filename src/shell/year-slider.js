export function mountYearSlider(el, store, years) {
  const min = years[0]
  const max = years[years.length - 1]
  el.innerHTML =
    '<label class="year-slider">ACS year ' +
    `<output class="year-value"></output>` +
    `<input class="year-input" type="range" min="${min}" max="${max}" step="1" />` +
    '</label>'
  const input = el.querySelector('.year-input')
  const output = el.querySelector('.year-value')

  const sync = (year) => {
    input.value = String(year)
    output.textContent = String(year)
  }

  input.addEventListener('input', () => {
    store.setState({ year: Number(input.value) })
  })

  store.subscribe((state) => sync(state.year))
  sync(store.getState().year)
}
