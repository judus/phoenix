import { expect, test } from 'vitest'
import { SavedGalaxyQueryService } from '../apps/server/src/application/saved-galaxy-query-service.js'
import { SqliteDatabase } from '../apps/server/src/infrastructure/sqlite-database.js'

test('saved Galaxy queries persist versioned query definitions without result data', () => {
  const database = new SqliteDatabase(':memory:')
  database.initialize()
  let now = new Date('2026-09-11T10:00:00.000Z')
  const service = new SavedGalaxyQueryService(
    database,
    () => now,
    () => '00000000-0000-4000-8000-000000000001'
  )

  try {
    const created = service.create({
      name: '  Tectonicas near me  ',
      parameters: { atmosphere: ['Thin Sulphur dioxide'], minBiologicalSignals: '1', origin: 'Smoje TO-Z d13-40' },
      queryId: 'exploration-targets'
    })
    expect(created).toMatchObject({
      name: 'Tectonicas near me',
      queryId: 'exploration-targets',
      schemaVersion: 1
    })
    expect(service.getAll()).toEqual({ queries: [created] })

    now = new Date('2026-09-11T10:05:00.000Z')
    const updated = service.update(created.id, {
      name: 'Tectonicas from Sol',
      parameters: { origin: 'Sol' },
      queryId: 'exploration-targets'
    })
    expect(updated).toMatchObject({
      createdAt: created.createdAt,
      name: 'Tectonicas from Sol',
      parameters: { origin: 'Sol' },
      updatedAt: '2026-09-11T10:05:00.000Z'
    })

    service.delete(created.id)
    expect(service.getAll()).toEqual({ queries: [] })
  } finally {
    database.close()
  }
})
