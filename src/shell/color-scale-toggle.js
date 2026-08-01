// Toggles how the sequential map scale is anchored:
//   'relative' — light→dark spans the on-screen [min, max]. Maximum contrast, but it
//                exaggerates small differences (a 5-point gap can look near-black vs pale).
//   'absolute' — light→dark spans [0, max], so a shade's darkness is proportional to the
//                actual value, not its rank within a narrow band.
// Only affects single-factor sequential maps; the header hides it for diverging /
// categorical / delta views where a zero anchor doesn't apply.
export function mountColorScaleToggle(el, store) {
  el.innerHTML =
    '<span class="scale-toggle">Shade ' +
    '<button class="scale-mode" data-mode="relative">Relative</button>' +
    '<button class="scale-mode" data-mode="absolute">From 0</button>' +
    '</span>'
  const buttons = [...el.querySelectorAll('.scale-mode')]

  const sync = (mode) =>
    buttons.forEach((b) => b.classList.toggle('on', b.dataset.mode === mode))

  buttons.forEach((b) =>
    b.addEventListener('click', () => store.setState({ colorScaling: b.dataset.mode }))
  )

  store.subscribe((s) => sync(s.colorScaling))
  sync(store.getState().colorScaling)
}
