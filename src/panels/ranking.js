import { FACTORS } from '../data/factors.js'

export function createRankingPanel() {
  let el = null
  let unsub = null

  const render = (store) => {
    const { dataset, factor } = store.getState()
    const fmt = FACTORS[factor]?.format ?? String
    const ranked = dataset.rows
      .filter((r) => r.value != null)
      .sort((a, b) => b.value - a.value)

    el.innerHTML = '<div class="rank-list"></div>'
    const list = el.querySelector('.rank-list')
    ranked.forEach((r, i) => {
      const row = document.createElement('div')
      row.className = 'rank-row'
      row.innerHTML =
        `<span class="rank">${i + 1}</span>` +
        `<span class="name">${r.name}</span>` +
        `<span class="value">${fmt(r.value)}</span>`
      list.appendChild(row)
    })
  }

  return {
    id: 'ranking',
    label: 'Ranking',
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
