// "Change over time" control: a checkbox that turns delta mode on, plus a baseline-year
// select. When on, the map colors each area by the signed change in the active factor
// between the baseline year and the current (slider) year. Off => store.baselineYear null.
export function mountBaselinePicker(el, store, years) {
  const earliest = years[0]
  el.innerHTML =
    `<label class="baseline-lbl"><input type="checkbox" class="baseline-on"> Δ change since</label>` +
    `<select class="baseline-year" disabled>` +
    years.map((y) => `<option value="${y}"${y === earliest ? ' selected' : ''}>${y}</option>`).join('') +
    `</select>`
  const cb = el.querySelector('.baseline-on')
  const sel = el.querySelector('.baseline-year')
  const apply = () => {
    sel.disabled = !cb.checked
    store.setState({ baselineYear: cb.checked ? Number(sel.value) : null })
  }
  cb.addEventListener('change', apply)
  sel.addEventListener('change', apply)
}
