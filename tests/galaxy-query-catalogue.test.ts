import { describe, expect, it } from 'vitest'
import { GALAXY_QUERY_CATALOGUE } from '../apps/web/src/features/galaxy/galaxy-query-catalogue.js'

describe('Galaxy query catalogue', () => {
  it('keeps query identities unique and required defaults usable', () => {
    const ids = GALAXY_QUERY_CATALOGUE.map(query => query.id)
    expect(new Set(ids).size).toBe(ids.length)

    for (const query of GALAXY_QUERY_CATALOGUE) {
      for (const field of query.fields) {
        if (field.required && field.id !== 'origin' && field.placeholder === undefined) {
          expect(query.defaults[field.id], `${query.id}.${field.id}`).not.toBeUndefined()
        }
        if (field.type === 'select') expect(field.options?.length, `${query.id}.${field.id}`).toBeGreaterThan(0)
      }
    }
  })

  it('groups queries by operational domain in a useful default order', () => {
    expect(GALAXY_QUERY_CATALOGUE.map(query => query.id)).toEqual([
      'nearby-systems',
      'filtered-systems',
      'exploration-targets',
      'facilities',
      'station-lookup',
      'shipyards',
      'outfitting-stock',
      'commodity-markets',
      'trade-opportunities',
      'faction-presence'
    ])
  })
})
