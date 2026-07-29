import { select } from 'd3-selection'
import { geoAlbersUsa, geoPath } from 'd3-geo'
import { scaleSequential, scaleDiverging } from 'd3-scale'
import { interpolateBlues, interpolateRdBu } from 'd3-scale-chromatic'
import { FACTORS } from '../data/factors.js'
import { tercileThresholds, binOf, bivariateColor, BIVARIATE_PALETTE } from './bivariate.js'

const NO_DATA_FILL = '#e8e8ea'

// The single-factor color scale: diverging red<->blue (centered at 0) for margin-style
// factors, otherwise a sequential blues ramp over the value extent.
const singleFactorScale = (state) => {
  const [min, max] = state.dataset.extent
  if (FACTORS[state.dataset.factor]?.scale === 'diverging') {
    const m = Math.max(Math.abs(min ?? 0), Math.abs(max ?? 0)) || 1
    return scaleDiverging(interpolateRdBu).domain([-m, 0, m])
  }
  return scaleSequential(interpolateBlues).domain(min == null ? [0, 1] : [min, max])
}

export function createMap(el, geo, store) {
  const root = select(el).classed('map', true)
  const svg = root.append('svg').attr('class', 'map-svg').attr('viewBox', '0 0 960 600')
  const gFeatures = svg.append('g').attr('class', 'features')
  const legend = root.append('div').attr('class', 'legend')
  const back = root
    .append('button')
    .attr('class', 'back-btn')
    .text('◀ Back to states')
    .style('display', 'none')
    .on('click', () => store.setState({ geoLevel: 'nation', selectedState: null, pinnedId: null }))

  const projection = geoAlbersUsa()
  const path = geoPath(projection)

  const currentFeatures = (state) =>
    state.geoLevel === 'state'
      ? geo.countyFeatures(state.selectedState)
      : geo.stateFeatures()

  const colorFor = (value, scale) =>
    value == null ? NO_DATA_FILL : scale(value)

  // Precompute { id -> { fill, biv } } for the on-screen features. In compare mode
  // (state.compare set) each area is colored by the pair of A/B terciles; otherwise by
  // the single-factor blues scale. `biv` is the "aBin bBin" tag, or null for no-data.
  const buildPaint = (state, features) => {
    const paint = {}
    if (state.compare) {
      const aValues = state.dataset.values
      const bValues = state.compare.valuesById
      const aThresh = tercileThresholds(features.map((f) => aValues[String(f.id)]))
      const bThresh = tercileThresholds(features.map((f) => bValues[String(f.id)]))
      for (const f of features) {
        const aBin = binOf(aValues[String(f.id)], aThresh)
        const bBin = binOf(bValues[String(f.id)], bThresh)
        const color = bivariateColor(aBin, bBin)
        paint[f.id] = { fill: color ?? NO_DATA_FILL, biv: color == null ? null : `${aBin}${bBin}` }
      }
      return paint
    }
    const scale = singleFactorScale(state)
    for (const f of features) {
      paint[f.id] = { fill: colorFor(state.dataset.values[String(f.id)], scale), biv: null }
    }
    return paint
  }

  const render = (state) => {
    const features = currentFeatures(state)
    const paint = buildPaint(state, features)

    projection.fitSize([960, 600], { type: 'FeatureCollection', features })

    const sel = gFeatures.selectAll('path.feature').data(features, (f) => f.id)
    sel.exit().remove()
    const entered = sel
      .enter()
      .append('path')
      .attr('class', 'feature')
      .attr('data-id', (f) => String(f.id))
      .on('pointerover', (_e, f) => store.setState({ hoveredId: String(f.id) }))
      .on('pointerout', () => store.setState({ hoveredId: null }))
      .on('click', (_e, f) => {
        if (store.getState().geoLevel === 'nation') {
          store.setState({ geoLevel: 'state', selectedState: String(f.id), pinnedId: null })
        } else {
          store.setState({ pinnedId: String(f.id) })
        }
      })

    entered
      .merge(sel)
      .attr('d', path)
      .attr('fill', (f) => paint[f.id].fill)
      .attr('data-biv', (f) => paint[f.id].biv)
      .classed('no-data', (f) => paint[f.id].fill === NO_DATA_FILL)
      .classed('pinned', (f) => String(f.id) === state.pinnedId)

    back.style('display', state.geoLevel === 'state' ? 'block' : 'none')
    if (state.compare) renderBivariateLegend(state)
    else renderLegend(state)
  }

  const renderLegend = (state) => {
    const [min, max] = state.dataset.extent
    const factor = FACTORS[state.dataset.factor]
    const fmt = factor?.format ?? String
    const diverging = factor?.scale === 'diverging'
    const scale = singleFactorScale(state)
    legend.attr('class', diverging ? 'legend diverging-legend' : 'legend').html('')
    legend.append('div').attr('class', 'legend-title').text(factor?.label ?? '')
    const ramp = legend.append('div').attr('class', 'ramp')
    if (min != null) {
      ramp.append('span').attr('class', 'lo').text(fmt(min))
      const gradient = diverging
        ? `linear-gradient(90deg, ${scale(min)}, ${scale(0)}, ${scale(max)})`
        : `linear-gradient(90deg, ${scale(min)}, ${scale(max)})`
      ramp.append('span').attr('class', 'bar').style('background', gradient)
      ramp.append('span').attr('class', 'hi').text(fmt(max))
    }
    const nd = legend.append('div').attr('class', 'no-data-row')
    nd.append('span').attr('class', 'no-data-swatch').style('background', NO_DATA_FILL)
    nd.append('span').text('No data')
  }

  const renderBivariateLegend = (state) => {
    const aLabel = FACTORS[state.dataset.factor]?.label ?? ''
    const bLabel = FACTORS[state.compare.factor]?.label ?? ''
    legend.attr('class', 'legend bivariate-legend').html('')
    const grid = legend.append('div').attr('class', 'biv-grid')
    // rows top→bottom are high→low A so the swatch reads like a chart (up = more A)
    for (let a = 2; a >= 0; a--) {
      for (let b = 0; b < 3; b++) {
        grid.append('span').attr('class', 'biv-cell').style('background', BIVARIATE_PALETTE[a][b])
      }
    }
    legend.append('div').attr('class', 'biv-axis biv-axis-a').text(`↑ ${aLabel}`)
    legend.append('div').attr('class', 'biv-axis biv-axis-b').text(`${bLabel} →`)
  }

  const unsub = store.subscribe(render)
  render(store.getState())
  return { unmount: () => { unsub(); root.selectAll('*').remove() } }
}
