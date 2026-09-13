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
      'system-search',
      'exploration-targets',
      'facilities',
      'station-lookup',
      'shipyards',
      'outfitting-stock',
      'market-signals',
      'commodity-markets',
      'trade-opportunities',
      'faction-presence'
    ])
    expect(GALAXY_QUERY_CATALOGUE.filter(query => query.id === 'system-search')).toEqual([
      expect.objectContaining({ title: 'System search' })
    ])
  })

  it('uses canonical exploration choices and keeps the report cutoff last', () => {
    const exploration = GALAXY_QUERY_CATALOGUE.find(query => query.id === 'exploration-targets')
    expect(exploration?.fields.at(-1)?.id).toBe('lastReportedBefore')
    for (const id of ['bodyType', 'atmosphere', 'volcanism']) {
      const field = exploration?.fields.find(candidate => candidate.id === id)
      expect(field?.type, id).toBe('multi-select')
      expect(field?.options?.length, id).toBeGreaterThan(1)
      expect(exploration?.defaults[id], id).toEqual([])
    }
  })
})
