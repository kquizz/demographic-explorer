const STEP_MS = 900 // dwell per year when playing through the range

export function mountYearSlider(el, store, years) {
  const min = years[0]
  const max = years[years.length - 1]
  el.innerHTML =
    '<label class="year-slider">ACS year ' +
    '<button class="year-play" type="button" aria-label="Play through the years" ' +
    'title="Play through the years">▶</button>' +
    '<output class="year-value"></output>' +
    `<input class="year-input" type="range" min="${min}" max="${max}" step="1" />` +
    '</label>'
  const input = el.querySelector('.year-input')
  const output = el.querySelector('.year-value')
  const play = el.querySelector('.year-play')

  let timer = null

  const sync = (year) => {
    input.value = String(year)
    output.textContent = String(year)
  }

  const stop = () => {
    if (timer) clearInterval(timer)
    timer = null
    play.textContent = '▶'
    play.classList.remove('on')
  }
  const start = () => {
    play.textContent = '⏸'
    play.classList.add('on')
    timer = setInterval(() => {
      const y = store.getState().year
      store.setState({ year: y >= max ? min : y + 1 }) // advance, looping at the end
    }, STEP_MS)
  }

  play.addEventListener('click', () => (timer ? stop() : start()))

  input.addEventListener('input', () => {
    stop() // manual scrubbing takes over from playback
    store.setState({ year: Number(input.value) })
  })

  store.subscribe((state) => sync(state.year))
  sync(store.getState().year)
}
