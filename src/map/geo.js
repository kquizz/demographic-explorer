import { feature } from 'topojson-client'

export function createGeo(topology) {
  const states = feature(topology, topology.objects.states).features
  const counties = feature(topology, topology.objects.counties).features

  const stateFeatures = () => states

  const countyFeatures = (statePrefix = null) =>
    statePrefix == null
      ? counties
      : counties.filter((f) => String(f.id).startsWith(statePrefix))

  const featureIds = (geoLevel, selectedState) =>
    geoLevel === 'state'
      ? countyFeatures(selectedState).map((f) => String(f.id))
      : stateFeatures().map((f) => String(f.id))

  return { stateFeatures, countyFeatures, featureIds }
}
