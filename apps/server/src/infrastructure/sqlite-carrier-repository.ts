import type { DatabaseSync } from 'node:sqlite'
import { CarrierObservationSchema, type CarrierObservation, type CarrierRepository } from '../domain/carriers.js'

export class SqliteCarrierRepository implements CarrierRepository {
  public constructor(private readonly connection: DatabaseSync) {}
  public initialize(): void {
    if (this.connection.prepare('SELECT 1 FROM schema_migrations WHERE version = 33').get()) return
    this.connection.exec('BEGIN IMMEDIATE')
    try {
      this.connection.exec(`
        CREATE TABLE carrier_observations (carrier_id INTEGER NOT NULL, kind TEXT NOT NULL, observed_at TEXT NOT NULL, document TEXT NOT NULL, PRIMARY KEY(carrier_id, kind)) STRICT;
        CREATE TABLE carrier_history (entry_id TEXT PRIMARY KEY, carrier_id INTEGER NOT NULL, observed_at TEXT NOT NULL, document TEXT NOT NULL) STRICT;
        CREATE INDEX carrier_history_time ON carrier_history(carrier_id, observed_at DESC);
        DELETE FROM elite_journal_checkpoints;
        INSERT INTO schema_migrations VALUES (33, datetime('now'));
        COMMIT;
      `)
    } catch (cause) { this.connection.exec('ROLLBACK'); throw cause }
  }
  public put(entry: CarrierObservation): void {
    const document = JSON.stringify(entry)
    this.connection.exec('BEGIN IMMEDIATE')
    try {
      this.connection.prepare(`INSERT INTO carrier_observations VALUES (?, ?, ?, ?) ON CONFLICT(carrier_id, kind)
        DO UPDATE SET observed_at = excluded.observed_at, document = excluded.document
        WHERE excluded.observed_at >= carrier_observations.observed_at`).run(entry.carrierId, entry.kind, entry.timestamp, document)
      this.connection.prepare('INSERT INTO carrier_history VALUES (?, ?, ?, ?) ON CONFLICT(entry_id) DO NOTHING').run(entry.id, entry.carrierId, entry.timestamp, document)
      this.connection.exec('COMMIT')
    } catch (cause) { this.connection.exec('ROLLBACK'); throw cause }
  }
  public observations(): CarrierObservation[] {
    return this.read('SELECT document FROM carrier_observations ORDER BY observed_at, rowid')
  }
  public history(carrierId: number): CarrierObservation[] {
    return this.read('SELECT document FROM carrier_history WHERE carrier_id = ? ORDER BY observed_at DESC, rowid DESC LIMIT 100', carrierId)
  }
  private read(sql: string, ...parameters: number[]): CarrierObservation[] {
    return (this.connection.prepare(sql).all(...parameters) as Array<{ document: string }>).map(row => CarrierObservationSchema.parse(JSON.parse(row.document)))
  }
}
