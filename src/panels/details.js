import { FACTORS } from '../data/factors.js'
import { createCensusClient } from '../data/censusClient.js'
import { signed } from '../lib/format.js'
import { sparkGeometry } from '../lib/sparkline.js'

const SW = 220, SH = 46, SPAD = 7

// A Census factor has a per-year value series; bundled sources (elections, trifectas) do
// not have a fetchable per-year census series, so only Census factors get a sparkline.
const isCensusFactor = (f) => !!f && !f.source

export function createDetailsPanel({ client = createCensusClient(), years = [] } = {}) {
  let el = null
  let store = null // the store's getState, wired at mount
  let unsub = null
  let sparkKey = null // `${factor}|${geoLevel}|${id}` of the series in sparkData
  let sparkData = null // [{ year, value }] for the shown area, once loaded
  let reqId = 0 // stale-guard: only the latest load may draw

  // The area whose trend we'd show — the same id the details value reflects — but only when
  // it's a Census factor. Null means "no sparkline" (nothing selected, or an election factor).
  const sparkTarget = (s) => {
    const f = FACTORS[s.factor]
    const id = s.pinnedId ?? s.hoveredId
    if (!id || !isCensusFactor(f)) return null
    return { id, factor: s.factor, geoLevel: s.geoLevel, key: `${s.factor}|${s.geoLevel}|${id}` }
  }

  const loadSeries = async (target) => {
    const my = ++reqId
    const f = FACTORS[target.factor]
    const args = { variable: f.variable, variables: f.variables, compute: f.compute, dataset: f.dataset }
    const series = await Promise.all(
      years.map((year) =>
        client
          .fetchFactor({ ...args, geoLevel: target.geoLevel, year })
          .then((rows) => ({ year, value: rows.find((r) => r.id === target.id)?.value ?? null }))
          .catch(() => ({ year, value: null }))
      )
    )
    if (my !== reqId || sparkKey !== target.key) return // superseded by a newer selection
    sparkData = series
    drawSpark()
  }

  const drawSpark = () => {
    const host = el && el.querySelector('.details-spark')
    if (!host || !sparkData) return
    const s = store()
    const f = FACTORS[s.factor]
    const fmt = f?.format ?? String
    const geo = sparkGeometry(sparkData, { w: SW, h: SH, pad: SPAD })
    if (!geo) {
      host.innerHTML = '<p class="spark-note">Not enough history to chart.</p>'
      return
    }
    const line = geo.points.map((p) => `${p.cx.toFixed(1)},${p.cy.toFixed(1)}`).join(' ')
    const now = geo.points.find((p) => p.year === s.year) ?? geo.points[geo.points.length - 1]
    const first = sparkData.find((d) => d.value != null)
    const last = [...sparkData].reverse().find((d) => d.value != null)
    const change = first && last ? last.value - first.value : null

    host.innerHTML =
      `<svg class="spark-svg" viewBox="0 0 ${SW} ${SH}" role="img">` +
      `<polyline class="spark-line" points="${line}"/>` +
      `<circle class="spark-now" cx="${now.cx.toFixed(1)}" cy="${now.cy.toFixed(1)}" r="3"/>` +
      '</svg>' +
      '<div class="spark-meta">' +
      `<span class="spark-range">${geo.minYear}–${geo.maxYear}</span>` +
      `<span class="spark-change">${first?.value == null ? '' : `${first.year}→${last.year}: ` +
        `${signed(fmt)(change)}`}</span>` +
      '</div>'
  }

  const render = () => {
    const { dataset, factor, hoveredId, pinnedId } = store()
    const id = pinnedId ?? hoveredId
    const fmt = dataset.format ?? FACTORS[factor]?.format ?? String
    const label = dataset.label ?? FACTORS[factor]?.label ?? factor

    if (!id) {
      el.innerHTML = '<p class="details-empty">Hover or select an area to see details.</p>'
      sparkKey = sparkData = null
      return
    }
    const entry = dataset.byId[id]
    const name = entry?.name ?? id
    const valueLine = entry
      ? `<span>${fmt(entry.value)}</span>`
      : '<span>No data</span>'
    el.innerHTML =
      `<div class="details"><h3>${name}</h3>` +
      `<div class="stat"><span>${label}</span>${valueLine}</div>` +
      '<div class="details-spark"></div></div>'

    const target = sparkTarget(store())
    if (!target) {
      sparkKey = sparkData = null
      return
    }
    if (target.key === sparkKey && sparkData) {
      drawSpark() // same selection: redraw the cached series (e.g. year slider moved)
      return
    }
    sparkKey = target.key
    sparkData = null
    loadSeries(target)
  }

  return {
    id: 'details',
    label: 'Details',
    mount(mountEl, s) {
      el = mountEl
      store = s.getState
      unsub = s.subscribe(render)
      render()
    },
    unmount() {
      if (unsub) unsub()
      if (el) el.innerHTML = ''
      el = unsub = store = null
      sparkKey = sparkData = null
    }
  }
}
