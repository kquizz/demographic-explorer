import { FACTOR_LIST, FACTORS } from '../data/factors.js'
import { createCensusClient } from '../data/censusClient.js'

export function createComparePanel({ client = createCensusClient() } = {}) {
  let el = null
  let store = null
  let unsub = null
  let factorB = null
  let bValuesById = {}
  let lastKey = null

  // Everything that determines the second-factor fetch AND the bivariate coloring.
  const compareKey = () => {
    const s = store.getState()
    return `${factorB}|${s.factor}|${s.geoLevel}|${s.selectedState}|${s.year}`
  }

  const buildTable = () => {
    const { dataset, factor } = store.getState()
    const fmtA = FACTORS[factor].format
    const fmtB = factorB ? FACTORS[factorB].format : String
    const rows = dataset.rows.slice().sort((a, b) => a.name.localeCompare(b.name))
    el.querySelector('.compare-table').innerHTML = rows
      .map((r) => {
        const bVal = bValuesById[r.id]
        return (
          `<div class="compare-row"><span class="name">${r.name}</span>` +
          `<span class="a">${fmtA(r.value)}</span>` +
          `<span class="b">${factorB ? fmtB(bVal == null ? null : bVal) : ''}</span></div>`
        )
      })
      .join('')
  }

  // Fetch factor B (if chosen) and publish it to the store so the map colors bivariately.
  const loadAndPublish = async () => {
    if (!factorB) {
      bValuesById = {}
      store.setState({ compare: null })
      buildTable()
      return
    }
    const { variable, variables, compute, dataset } = FACTORS[factorB]
    const { geoLevel, year } = store.getState()
    const rows = await client.fetchFactor({ variable, variables, compute, dataset, geoLevel, year })
    bValuesById = Object.fromEntries(rows.map((r) => [r.id, r.value]))
    store.setState({ compare: { factor: factorB, valuesById: bValuesById } })
    buildTable()
  }

  const renderPicker = () => {
    const { factor } = store.getState()
    // Factor B can't be factor A; if A just became what B was, drop B.
    if (factorB === factor) factorB = null
    const opts = FACTOR_LIST.filter((f) => f.id !== factor)
      .map((f) => `<option value="${f.id}"${f.id === factorB ? ' selected' : ''}>${f.label}</option>`)
      .join('')
    el.innerHTML =
      `<div class="compare"><label>Compare with:` +
      `<select class="compare-pick"><option value="">— pick a factor —</option>${opts}</select>` +
      `</label><div class="compare-table"></div></div>`
    el.querySelector('.compare-pick').addEventListener('change', (e) => {
      factorB = e.target.value || null
      lastKey = compareKey()
      loadAndPublish()
    })
  }

  return {
    id: 'compare',
    label: 'Compare',
    mount(mountEl, s) {
      el = mountEl
      store = s
      renderPicker()
      lastKey = compareKey()
      unsub = store.subscribe(() => {
        // React only when the compare inputs change (factor A / geo / year) — not on
        // hover, and not to our own `compare` write (which leaves the key unchanged).
        const key = compareKey()
        if (key === lastKey) return
        lastKey = key
        renderPicker()
        loadAndPublish()
      })
    },
    unmount() {
      if (unsub) unsub()
      if (store) store.setState({ compare: null }) // revert the map to a single factor
      if (el) el.innerHTML = ''
      el = store = unsub = null
      factorB = null
      bValuesById = {}
      lastKey = null
    }
  }
}
