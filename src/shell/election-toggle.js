export function mountElectionYearToggle(el, store, years) {
  el.innerHTML =
    '<span class="election-toggle">Election ' +
    years.map((y) => `<button class="election-year" data-year="${y}">${y}</button>`).join('') +
    '</span>'
  const buttons = [...el.querySelectorAll('.election-year')]

  const sync = (year) =>
    buttons.forEach((b) => b.classList.toggle('on', Number(b.dataset.year) === year))

  buttons.forEach((b) =>
    b.addEventListener('click', () => store.setState({ electionYear: Number(b.dataset.year) }))
  )

  store.subscribe((s) => sync(s.electionYear))
  sync(store.getState().electionYear)
}
