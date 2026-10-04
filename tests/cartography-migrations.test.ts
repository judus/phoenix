import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { expect, test, vi } from 'vitest'
import type { CartographicSystem } from '@phoenix/contracts'
import type { LocalSystemCartographyObservation } from '../apps/server/src/domain/cartography.js'
import { SqliteDatabase } from '../apps/server/src/infrastructure/sqlite-database.js'

test.each([12, 14, 15] as const)('pending external migration %i retains mixed-source and local-only records', version => {
  withRetainedDatabase((path, retained) => {
    retained.prepare('DELETE FROM schema_migrations WHERE version BETWEEN ? AND 15').run(version)
    const legacy = { ...system('Sol'), schemaVersion: 2 }
    retained.prepare('UPDATE cartography_records SET external_document = ? WHERE system_key = ?').run(JSON.stringify(legacy), 'sol')
    retained.close()

    const database = new SqliteDatabase(path)
    try {
      database.initialize()
      expect(database.findRecord('Sol')).toEqual({ systemName: 'Sol', external: system('Sol'), local: observation('Sol') })
      expect(database.findRecord('Local only')).toEqual({ systemName: 'Local only', external: null, local: observation('Local only') })
    } finally {
      database.close()
    }
    const migrated = new DatabaseSync(path)
    try {
      expect(migrated.prepare('SELECT version FROM schema_migrations WHERE version BETWEEN 12 AND 15 ORDER BY version').all())
        .toEqual([12, 13, 14, 15].map(version => ({ version })))
      expect(migrated.prepare('SELECT count(*) AS count FROM cartography_records').get()).toEqual({ count: 2 })
    } finally {
      migrated.close()
    }
  })
})

test.each([12, 14, 15] as const)('corrupt external data rolls back migration %i without marking it applied', version => {
  withRetainedDatabase((path, retained) => {
    retained.prepare('DELETE FROM schema_migrations WHERE version BETWEEN ? AND 15').run(version)
    const legacy = JSON.stringify({ ...system('Sol'), schemaVersion: 2 })
    retained.prepare('UPDATE cartography_records SET external_document = ? WHERE system_key = ?').run(legacy, 'sol')
    retained.prepare('INSERT INTO cartography_records (system_key, system_name, external_fetched_at, external_document) VALUES (?, ?, ?, ?)')
      .run('broken', 'Broken', timestamp, '{broken')
    retained.close()

    const database = new SqliteDatabase(path)
    const writes = vi.spyOn(database, 'putExternalSystem')
    try {
      expect(() => database.initialize()).toThrow()
      expect(writes).toHaveBeenCalledTimes(1)
    } finally {
      database.close()
    }
    const failed = new DatabaseSync(path)
    try {
      expect(failed.prepare('SELECT external_document FROM cartography_records WHERE system_key = ?').get('sol'))
        .toEqual({ external_document: legacy })
      expect(failed.prepare('SELECT version FROM schema_migrations WHERE version BETWEEN ? AND 15').all(version)).toEqual([])
      expect(failed.prepare('SELECT local_document FROM cartography_records WHERE system_key = ?').get('sol'))
        .toEqual({ local_document: JSON.stringify(observation('Sol')) })
    } finally {
      failed.close()
    }
  })
})

const timestamp = '2026-08-11T12:00:00.000Z'

test('external migration 12 commits before local migration 13 fails, leaving 14 and 15 unapplied', () => {
  withRetainedDatabase((path, retained) => {
    retained.exec('DELETE FROM schema_migrations WHERE version BETWEEN 12 AND 15')
    retained.prepare('UPDATE cartography_records SET external_document = ?, local_document = ? WHERE system_key = ?')
      .run(JSON.stringify({ ...system('Sol'), schemaVersion: 2 }), '{broken', 'sol')
    retained.close()
    const database = new SqliteDatabase(path)
    try {
      expect(() => database.initialize()).toThrow()
    } finally {
      database.close()
    }
    const failed = new DatabaseSync(path)
    try {
      expect(failed.prepare('SELECT version FROM schema_migrations WHERE version BETWEEN 12 AND 15').all()).toEqual([{ version: 12 }])
      expect(failed.prepare('SELECT external_document, local_document FROM cartography_records WHERE system_key = ?').get('sol'))
        .toEqual({ external_document: JSON.stringify(system('Sol')), local_document: '{broken' })
    } finally {
      failed.close()
    }
  })
})

function withRetainedDatabase (review: (path: string, retained: DatabaseSync) => void): void {
  const directory = mkdtempSync(join(tmpdir(), 'phoenix-cartography-migrations-'))
  const path = join(directory, 'phoenix.sqlite')
  const database = new SqliteDatabase(path)
  database.initialize()
  database.putExternalSystem(system('Sol'))
  database.putLocalObservation(observation('Sol'))
  database.putLocalObservation(observation('Local only'))
  database.close()
  const retained = new DatabaseSync(path)
  try {
    review(path, retained)
  } finally {
    if (retained.isOpen) retained.close()
    rmSync(directory, { recursive: true, force: true })
  }
}

function observation (systemName: string): LocalSystemCartographyObservation {
  return { allBodiesFound: false, bodies: [], reportedBodyCount: null, systemAddress: null, systemName, updatedAt: timestamp }
}

function system (name: string): CartographicSystem {
  return {
    schemaVersion: 5, name, address: null, position: null, permitRequired: null, permitName: null,
    information: { allegiance: null, government: null, security: null, state: null, primaryEconomy: null, secondaryEconomy: null, population: null, controllingFaction: null },
    primaryStar: null, bodies: [], stations: [], scanProgress: { knownBodies: 0, reportedBodies: null, percent: null },
    localSystem: null, provenance: { edsm: { fetchedAt: timestamp }, journal: null },
    raw: { system: {}, bodies: {}, stations: {} }
  }
}
