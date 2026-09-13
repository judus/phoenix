import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { DatabaseSync } from 'node:sqlite'
import { expect, test } from 'vitest'
import { SavedGalaxyQueryService } from '../apps/server/src/application/saved-galaxy-query-service.js'
import { SqliteDatabase } from '../apps/server/src/infrastructure/sqlite-database.js'

test('saved Galaxy queries persist versioned query definitions without result data', () => {
  const database = new SqliteDatabase(':memory:')
  database.initialize()
  let now = new Date('2026-09-11T10:00:00.000Z')
  const service = new SavedGalaxyQueryService(
    database.savedGalaxyQueries,
    () => now,
    () => '00000000-0000-4000-8000-000000000001'
  )

  try {
    const created = service.create({
      name: '  Tectonicas near me  ',
      parameters: { atmosphere: ['Thin Sulphur dioxide'], minBiologicalSignals: '1', origin: 'Smoje TO-Z d13-40' },
      queryId: 'exploration-targets',
      useOnDashboard: false
    })
    expect(created).toMatchObject({
      name: 'Tectonicas near me',
      queryId: 'exploration-targets',
      schemaVersion: 2,
      useOnDashboard: false
    })
    expect(service.getAll()).toEqual({ queries: [created] })

    now = new Date('2026-09-11T10:05:00.000Z')
    const updated = service.update(created.id, {
      name: 'Tectonicas from Sol',
      parameters: { origin: 'Sol' },
      queryId: 'exploration-targets',
      useOnDashboard: false
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

test('only one Market Signals query is selected for the dashboard', () => {
  const database = new SqliteDatabase(':memory:')
  database.initialize()
  let id = 0
  const service = new SavedGalaxyQueryService(
    database.savedGalaxyQueries,
    () => new Date('2026-09-13T10:00:00.000Z'),
    () => `00000000-0000-4000-8000-${String(++id).padStart(12, '0')}`
  )

  try {
    const first = service.create({ name: 'Cheap cargo', parameters: {}, queryId: 'market-signals', useOnDashboard: true })
    const second = service.create({ name: 'High sell prices', parameters: {}, queryId: 'market-signals', useOnDashboard: true })

    expect(service.getDashboardQuery('market-signals')?.id).toBe(second.id)
    expect(service.getAll().queries.find(query => query.id === first.id)?.useOnDashboard).toBe(false)
    expect(() => service.create({ name: 'Not a dashboard source', parameters: {}, queryId: 'system-search', useOnDashboard: true }))
      .toThrow('Only a Market Signals query can be used on the Dashboard.')
  } finally {
    database.close()
  }
})

test('saved Galaxy query documents migrate to the dashboard-aware schema', () => {
  const directory = mkdtempSync(join(tmpdir(), 'phoenix-saved-query-migration-'))
  const path = join(directory, 'phoenix.sqlite')
  const initial = new SqliteDatabase(path)
  initial.initialize()
  initial.close()
  const raw = new DatabaseSync(path)
  const legacy = {
    createdAt: '2026-09-11T10:00:00.000Z',
    id: '00000000-0000-4000-8000-000000000001',
    name: 'Legacy query',
    parameters: { origin: 'Sol' },
    queryId: 'system-search',
    schemaVersion: 1,
    updatedAt: '2026-09-11T10:00:00.000Z'
  }
  raw.prepare('DELETE FROM schema_migrations WHERE version = 20').run()
  raw.prepare('INSERT INTO saved_galaxy_queries (query_id, updated_at, document) VALUES (?, ?, ?)')
    .run(legacy.id, legacy.updatedAt, JSON.stringify(legacy))
  raw.close()

  const migrated = new SqliteDatabase(path)
  try {
    migrated.initialize()
    expect(migrated.savedGalaxyQueries.getSavedGalaxyQuery(legacy.id)).toMatchObject({
      schemaVersion: 2,
      useOnDashboard: false
    })
  } finally {
    migrated.close()
    rmSync(directory, { force: true, recursive: true })
  }
})
