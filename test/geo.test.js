import { describe, it, expect } from 'vitest'
import topology from './fixtures/topo-mini.json'
import { createGeo } from '../src/map/geo.js'

describe('createGeo', () => {
  const geo = createGeo(topology)

  it('returns state features with FIPS ids', () => {
    const ids = geo.stateFeatures().map((f) => f.id)
    expect(ids).toEqual(['01', '02'])
  })

  it('filters county features by 2-digit state prefix', () => {
    const ids = geo.countyFeatures('01').map((f) => f.id)
    expect(ids).toEqual(['01001'])
  })

  it('returns all counties when no state prefix is given', () => {
    expect(geo.countyFeatures().map((f) => f.id)).toEqual(['01001', '02013'])
  })

  it('lists state feature ids at nation level', () => {
    expect(geo.featureIds('nation', null)).toEqual(['01', '02'])
  })

  it('lists that state\'s county feature ids at state level', () => {
    expect(geo.featureIds('state', '02')).toEqual(['02013'])
  })
})
