export function mountSearch(el, store, geo) {
  el.innerHTML =
    '<input class="search-input" type="search" placeholder="Search state or county…" />' +
    '<div class="search-options"></div>'
  const input = el.querySelector('.search-input')
  const options = el.querySelector('.search-options')

  const candidates = () => store.getState().dataset.rows

  const select = (row) => {
    const id = String(row.id)
    if (id.length <= 2) {
      // A state hit zooms into that state; no specific county is pinned yet.
      store.setState({ geoLevel: 'state', selectedState: id, pinnedId: null })
    } else {
      // A county hit zooms into its parent state and pins the county.
      store.setState({ geoLevel: 'state', selectedState: id.slice(0, 2), pinnedId: id })
    }
    input.value = row.name
    options.innerHTML = ''
  }

  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase()
    options.innerHTML = ''
    if (!q) return
    candidates()
      .filter((r) => r.name.toLowerCase().includes(q))
      .slice(0, 8)
      .forEach((r) => {
        const opt = document.createElement('button')
        opt.className = 'search-option'
        opt.textContent = r.name
        opt.addEventListener('click', () => select(r))
        options.appendChild(opt)
      })
  })
}
