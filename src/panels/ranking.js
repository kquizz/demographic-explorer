import { FACTORS } from '../data/factors.js'

export function createRankingPanel() {
  let el = null
  let unsub = null

  const render = (store) => {
    const { dataset, factor } = store.getState()
    const fmt = dataset.format ?? FACTORS[factor]?.format ?? String
    const ranked = dataset.rows
      .filter((r) => r.value != null)
      .sort((a, b) => b.value - a.value)

    // Scale each row's bar across the on-screen min→max range, not from zero, so a
    // clustered range (e.g. incomes $75k–$106k) still reads as a visible spread instead
    // of a column of near-full bars. A small floor keeps the lowest bar from vanishing.
    const vals = ranked.map((r) => r.value)
    const min = Math.min(...vals)
    const max = Math.max(...vals)
    const span = max - min

    el.innerHTML = '<div class="rank-list"></div>'
    const list = el.querySelector('.rank-list')
    ranked.forEach((r, i) => {
      const pct = span ? Math.round(((r.value - min) / span) * 96) + 4 : 100
      const row = document.createElement('div')
      row.className = 'rank-row'
      row.innerHTML =
        `<span class="rank">${i + 1}</span>` +
        `<span class="name">${r.name}</span>` +
        `<span class="value">${fmt(r.value)}</span>` +
        `<span class="rank-bar" style="width:${pct}%"></span>`
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
