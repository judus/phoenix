import { DatabaseSync } from 'node:sqlite'
import { expect, test } from 'vitest'
import { SqliteCarrierRepository } from '../apps/server/src/infrastructure/sqlite-carrier-repository.js'
import type { CarrierObservation } from '../apps/server/src/domain/carriers.js'

test.each([false, true])('carrier migration upgrades version33 (sequence present: %s) without losing records or changing order', sequenced => {
  const connection = new DatabaseSync(':memory:')
  try {
    connection.exec(`
      CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL) STRICT;
      INSERT INTO schema_migrations VALUES(33, '2026-10-10');
      CREATE TABLE unrelated_records(document TEXT NOT NULL) STRICT;
      INSERT INTO unrelated_records VALUES('preserve me');
      CREATE TABLE carrier_observations(carrier_id INTEGER NOT NULL, kind TEXT NOT NULL, observed_at TEXT NOT NULL, ${sequenced ? 'sequence INTEGER NOT NULL,' : ''} document TEXT NOT NULL, PRIMARY KEY(carrier_id, kind)) STRICT;
      CREATE TABLE carrier_history(${sequenced ? 'sequence INTEGER PRIMARY KEY, entry_id TEXT NOT NULL UNIQUE' : 'entry_id TEXT PRIMARY KEY'}, carrier_id INTEGER NOT NULL, observed_at TEXT NOT NULL, document TEXT NOT NULL) STRICT;
      CREATE INDEX carrier_history_time ON carrier_history(carrier_id, observed_at DESC);
    `)
    const snapshot = observation('snapshot', 'CarrierStats', { name: 'Synthetic carrier' })
    const mutation = observation('mutation', 'CarrierNameChange', { name: 'Renamed carrier' })
    for (const [index, entry] of [snapshot, mutation].entries()) {
      const sequence = index + 1
      connection.prepare('INSERT INTO carrier_history(entry_id, carrier_id, observed_at, document) VALUES(?, ?, ?, ?)').run(entry.id, entry.carrierId, entry.timestamp, JSON.stringify(entry))
      connection.prepare(`INSERT INTO carrier_observations VALUES(${sequenced ? '?, ?, ?, ?, ?' : '?, ?, ?, ?'})`)
        .run(...(sequenced ? [entry.carrierId, entry.kind, entry.timestamp, sequence, JSON.stringify(entry)] : [entry.carrierId, entry.kind, entry.timestamp, JSON.stringify(entry)]))
    }
    const repository = new SqliteCarrierRepository(connection)
    repository.initialize()
    expect(repository.observations()).toEqual([snapshot, mutation])
    expect(repository.history(42)).toEqual([mutation, snapshot])
    expect(connection.prepare('SELECT document FROM unrelated_records').get()).toEqual({ document: 'preserve me' })
    expect(connection.prepare('SELECT version FROM schema_migrations ORDER BY version').all()).toEqual([{ version: 33 }, { version: 34 }])
    repository.initialize()
    repository.put(snapshot)
    expect(repository.observations()).toEqual([snapshot, mutation])
    const newer = { ...mutation, id: 'newer', timestamp: '2026-10-10T11:00:00.000Z', patch: { name: 'New name' } }
    repository.put(newer)
    expect(repository.observations()).toEqual([snapshot, newer])
    expect(repository.history(42)).toEqual([newer, mutation, snapshot])
  } finally { connection.close() }
})

function observation(id: string, kind: string, patch: CarrierObservation['patch']): CarrierObservation {
  return { id, kind, carrierId: 42, timestamp: '2026-10-10T10:00:00.000Z', description: kind, patch, managementEvidence: kind === 'CarrierStats' }
}
