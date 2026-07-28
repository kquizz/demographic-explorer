import { FACTOR_LIST, FACTORS } from '../data/factors.js'
import { createCensusClient } from '../data/censusClient.js'

export function createComparePanel({ client = createCensusClient() } = {}) {
  let el = null
  let unsub = null
  let factorB = null
  let bValuesById = {}

  const buildTable = (store) => {
    const { dataset, factor } = store.getState()
    const fmtA = FACTORS[factor].format
    const fmtB = factorB ? FACTORS[factorB].format : String
    const rows = dataset.rows.slice().sort((a, b) => a.name.localeCompare(b.name))

    const body = rows
      .map((r) => {
        const bVal = bValuesById[r.id]
        return (
          `<div class="compare-row"><span class="name">${r.name}</span>` +
          `<span class="a">${fmtA(r.value)}</span>` +
          `<span class="b">${factorB ? fmtB(bVal == null ? null : bVal) : ''}</span></div>`
        )
      })
      .join('')
    el.querySelector('.compare-table').innerHTML = body
  }

  const loadB = async (store) => {
    const { variable, dataset } = FACTORS[factorB]
    const geoLevel = store.getState().geoLevel
    const rows = await client.fetchFactor({ variable, dataset, geoLevel })
    bValuesById = Object.fromEntries(rows.map((r) => [r.id, r.value]))
    buildTable(store)
  }

  const renderPicker = (store) => {
    const { factor } = store.getState()
    const opts = FACTOR_LIST.filter((f) => f.id !== factor)
      .map((f) => `<option value="${f.id}">${f.label}</option>`)
      .join('')
    el.innerHTML =
      `<div class="compare"><label>Compare with:` +
      `<select class="compare-pick"><option value="">— pick a factor —</option>${opts}</select>` +
      `</label><div class="compare-table"></div></div>`
    el.querySelector('.compare-pick').addEventListener('change', (e) => {
      factorB = e.target.value || null
      bValuesById = {}
      if (factorB) loadB(store)
      else buildTable(store)
    })
  }

  return {
    id: 'compare',
    label: 'Compare',
    mount(mountEl, store) {
      el = mountEl
      renderPicker(store)
      unsub = store.subscribe(() => {
        renderPicker(store)
        if (factorB) {
          el.querySelector('.compare-pick').value = factorB
          loadB(store)
        }
      })
    },
    unmount() {
      if (unsub) unsub()
      if (el) el.innerHTML = ''
      el = unsub = null
      factorB = null
      bValuesById = {}
    }
  }
}
