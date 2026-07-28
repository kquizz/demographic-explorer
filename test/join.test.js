import { describe, it, expect } from 'vitest'
import { join } from '../src/data/join.js'

const rows = [
  { id: '01', name: 'Alabama', value: 54943 },
  { id: '02', name: 'Alaska', value: 80287 }
]

describe('join', () => {
  it('maps every feature id to its value', () => {
    expect(join(['01', '02'], rows)).toEqual({ '01': 54943, '02': 80287 })
  })

  it('fills feature ids with no matching row as null (explicit no-data)', () => {
    expect(join(['01', '99'], rows)).toEqual({ '01': 54943, '99': null })
  })

  it('ignores rows whose id is not in the requested feature set', () => {
    expect(join(['01'], rows)).toEqual({ '01': 54943 })
  })
})
