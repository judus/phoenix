import { describe, expect, it } from 'vitest'
import { GALAXY_QUERY_CATALOGUE } from '../apps/web/src/features/galaxy/galaxy-query-catalogue.js'
import { loadPredefinedGalaxyQueries } from '../apps/server/src/infrastructure/predefined-galaxy-queries.js'

describe('Galaxy query catalogue', () => {
  it('keeps reported-target defaults separate from the predefined saved query', () => {
    const exploration = GALAXY_QUERY_CATALOGUE.find(query => query.id === 'exploration-targets')!
    expect(exploration.defaults).toMatchObject({ landable: 'yes', minBiologicalSignals: '1', lastReportedBefore: '' })
    const [preset] = loadPredefinedGalaxyQueries('resources/queries')
    expect(preset!.parameters).toMatchObject({
      landable: 'any', minBiologicalSignals: '0', minGeologicalSignals: '0', lastReportedBefore: '2021-05-18',
      bodyType: ['High metal content world'], minTemperatureK: '165', maxTemperatureK: '',
      minGravityG: '', maxGravityG: '', volcanism: [],
      atmosphere: ['Thin Ammonia', 'Thin Carbon dioxide', 'Thin Carbon dioxide-rich', 'Thin Oxygen', 'Thin Sulphur dioxide', 'Thin Water', 'Thin Water-rich']
    })
    expect(preset!.parameters).toMatchObject({ origin: '', originMode: 'current', maxDistance: '500' })
    for (const [id, value] of Object.entries(preset!.parameters)) {
      if (id === 'originMode') continue
      const field = exploration.fields.find(field => field.id === id)!
      expect(field).toBeDefined()
      if (field.options) for (const option of Array.isArray(value) ? value : [value]) expect(field.options.map(choice => choice.value)).toContain(option)
    }
    const hint = exploration.fields.find(field => field.id === 'lastReportedBefore')!.hint!
    for (const wording of ['2021-05-18', 'Landable = Any', 'no signal-count constraint', 'not guaranteed']) expect(hint).toContain(wording)
    expect(hint).not.toContain('2021-05-19')
  })
  it('requires only a station name and leaves all narrowing filters optional', () => {
    const query = GALAXY_QUERY_CATALOGUE.find(query => query.id === 'station-lookup')!
    expect(query.fields.filter(field => field.required).map(field => field.id)).toEqual(['name'])
    expect(query.fields.map(field => field.id)).toEqual(['name', 'origin', 'radius', 'stationType', 'pad'])
    expect(query.defaults).toEqual({ name: '', origin: '', radius: '', stationType: 'any', pad: '' })
  })
  it('accepts fractional gravity without relaxing integer signal counts', () => {
    const exploration = GALAXY_QUERY_CATALOGUE.find(query => query.id === 'exploration-targets')!
    for (const id of ['minGravityG', 'maxGravityG']) {
      expect(exploration.fields.find(field => field.id === id)).toMatchObject({ min: 0, step: 'any', type: 'number' })
    }
    for (const id of ['minBiologicalSignals', 'minGeologicalSignals']) {
      expect(exploration.fields.find(field => field.id === id)?.step).toBeUndefined()
    }
  })

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
