import { select } from 'd3-selection'
import { geoAlbersUsa, geoPath } from 'd3-geo'
import { scaleSequential } from 'd3-scale'
import { interpolateBlues } from 'd3-scale-chromatic'
import { FACTORS } from '../data/factors.js'

const NO_DATA_FILL = '#e8e8ea'

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

  const render = (state) => {
    const features = currentFeatures(state)
    const { values, extent } = state.dataset
    const scale = scaleSequential(interpolateBlues).domain(extent[0] == null ? [0, 1] : extent)

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
      .attr('fill', (f) => colorFor(values[String(f.id)], scale))
      .classed('no-data', (f) => values[String(f.id)] == null)
      .classed('pinned', (f) => String(f.id) === state.pinnedId)

    back.style('display', state.geoLevel === 'state' ? 'block' : 'none')
    renderLegend(state, scale)
  }

  const renderLegend = (state, scale) => {
    const [min, max] = state.dataset.extent
    const factor = FACTORS[state.dataset.factor]
    const fmt = factor?.format ?? String
    legend.html('')
    legend.append('div').attr('class', 'legend-title').text(factor?.label ?? '')
    const ramp = legend.append('div').attr('class', 'ramp')
    if (min != null) {
      ramp.append('span').attr('class', 'lo').text(fmt(min))
      ramp
        .append('span')
        .attr('class', 'bar')
        .style('background', `linear-gradient(90deg, ${scale(min)}, ${scale(max)})`)
      ramp.append('span').attr('class', 'hi').text(fmt(max))
    }
    const nd = legend.append('div').attr('class', 'no-data-row')
    nd.append('span').attr('class', 'no-data-swatch').style('background', NO_DATA_FILL)
    nd.append('span').text('No data')
  }

  const unsub = store.subscribe(render)
  render(store.getState())
  return { unmount: () => { unsub(); root.selectAll('*').remove() } }
}
