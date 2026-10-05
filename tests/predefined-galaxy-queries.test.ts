import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { expect, test, vi } from 'vitest'
import { SavedGalaxyQueryService } from '../apps/server/src/application/saved-galaxy-query-service.js'
import { loadPredefinedGalaxyQueries } from '../apps/server/src/infrastructure/predefined-galaxy-queries.js'
import { SqliteDatabase } from '../apps/server/src/infrastructure/sqlite-database.js'

const definitions = loadPredefinedGalaxyQueries('resources/queries')

test('explicit imports are idempotent, preserve edits, do not identify queries by name, and notify once', () => {
  const database = new SqliteDatabase(':memory:')
  database.initialize()
  const changed = vi.fn()
  const service = new SavedGalaxyQueryService(database.savedGalaxyQueries, undefined, undefined, changed, definitions)
  try {
    const userQuery = service.create({ name: definitions[0]!.name, queryId: 'exploration-targets', parameters: { origin: 'Colonia' }, useOnDashboard: false })
    changed.mockClear()
    const first = service.importPredefined().queries
    expect(first).toHaveLength(2)
    expect(changed).toHaveBeenCalledTimes(1)
    const predefined = first.find(query => query.id === definitions[0]!.id)!
    const edited = service.update(predefined.id, { name: 'My version', queryId: predefined.queryId, parameters: { origin: 'Sol', maxDistance: '50' }, useOnDashboard: false })
    changed.mockClear()
    expect(service.importPredefined().queries).toEqual(expect.arrayContaining([edited, userQuery]))
    expect(changed).not.toHaveBeenCalled()
    service.delete(predefined.id)
    expect(service.getAll().queries).toEqual([userQuery])
    expect(service.importPredefined().queries).toHaveLength(2)
  } finally { database.close() }
})

test.each(['edited', 'deleted'] as const)('profile restart preserves %s defaults; an empty existing profile is not new', state => {
  const directory = mkdtempSync(join(tmpdir(), 'phoenix-predefined-'))
  const path = join(directory, 'profile.sqlite')
  let database = new SqliteDatabase(path)
  try {
    expect(database.initialize()).toBe(true)
    let service = new SavedGalaxyQueryService(database.savedGalaxyQueries, undefined, undefined, undefined, definitions)
    service.importPredefined()
    const saved = service.getAll().queries[0]!
    if (state === 'edited') service.update(saved.id, { name: 'Retained edit', queryId: saved.queryId, parameters: { origin: 'Colonia' }, useOnDashboard: false })
    else service.delete(saved.id)
    const expected = service.getAll()
    database.close()
    database = new SqliteDatabase(path)
    const newProfile = database.initialize()
    expect(newProfile).toBe(false)
    service = new SavedGalaxyQueryService(database.savedGalaxyQueries, undefined, undefined, undefined, definitions)
    if (newProfile) service.importPredefined()
    expect(service.getAll()).toEqual(expected)
  } finally { database.close(); rmSync(directory, { recursive: true, force: true }) }
})

test('an invalid batch writes nothing', () => {
  const database = new SqliteDatabase(':memory:')
  database.initialize()
  const service = new SavedGalaxyQueryService(database.savedGalaxyQueries, undefined, undefined, undefined, definitions)
  try {
    const valid = service.importPredefined().queries[0]!
    service.delete(valid.id)
    expect(() => database.savedGalaxyQueries.insertMissingSavedGalaxyQueries([valid, { ...valid, id: 'invalid' }])).toThrow()
    expect(service.getAll().queries).toEqual([])
  } finally { database.close() }
})
