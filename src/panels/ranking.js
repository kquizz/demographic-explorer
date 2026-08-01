import { scaleDiverging } from 'd3-scale'
import { interpolateBlues, interpolateRdBu } from 'd3-scale-chromatic'
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
    const vals = ranked.map((r) => r.value).filter((v) => Number.isFinite(v))
    const min = vals.length ? Math.min(...vals) : 0
    const max = vals.length ? Math.max(...vals) : 0
    const span = max - min

    // Color the bar by value with the same D3 scales the map uses, so the leaderboard and
    // the choropleth read as one palette: diverging red↔blue for margin/delta factors,
    // otherwise the blues ramp (floored at 0.15 so the lowest bar still shows a tint).
    const diverging = dataset.diverging || FACTORS[factor]?.scale === 'diverging'
    const m = Math.max(Math.abs(min), Math.abs(max)) || 1
    const rdbu = scaleDiverging(interpolateRdBu).domain([-m, 0, m])
    const colorFor = (v) => {
      if (!Number.isFinite(v)) return '#c3ccdb'
      if (diverging) return rdbu(v)
      return interpolateBlues(0.15 + 0.85 * (span ? (v - min) / span : 1))
    }

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
        `<span class="rank-bar" style="width:${pct}%;background:${colorFor(r.value)}"></span>`
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
