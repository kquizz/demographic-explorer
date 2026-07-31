import { FACTORS } from '../data/factors.js'

export function createDetailsPanel() {
  let el = null
  let unsub = null

  const render = (store) => {
    const { dataset, factor, hoveredId, pinnedId } = store.getState()
    const id = pinnedId ?? hoveredId
    const fmt = dataset.format ?? FACTORS[factor]?.format ?? String
    const label = dataset.label ?? FACTORS[factor]?.label ?? factor

    if (!id) {
      el.innerHTML = '<p class="details-empty">Hover or select an area to see details.</p>'
      return
    }
    const entry = dataset.byId[id]
    if (!entry) {
      el.innerHTML =
        `<div class="details"><h3>${id}</h3>` +
        `<div class="stat"><span>${label}</span><span>No data</span></div></div>`
      return
    }
    el.innerHTML =
      `<div class="details"><h3>${entry.name}</h3>` +
      `<div class="stat"><span>${label}</span><span>${fmt(entry.value)}</span></div></div>`
  }

  return {
    id: 'details',
    label: 'Details',
    mount(mountEl, store) {
      el = mountEl
      unsub = store.subscribe(() => render(store))
      render(store)
    },
    unmount() {
      if (unsub) unsub()
      if (el) el.innerHTML = ''
      el = unsub = null
    }
  }
}
