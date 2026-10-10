import type { DatabaseSync } from 'node:sqlite'
import { PowerplayEntrySchema, PowerplayTargetSchema, type PowerplayEntry, type PowerplayTarget } from '@phoenix/contracts'
import type { PowerplayRepository } from '../domain/powerplay.js'

export class SqlitePowerplayRepository implements PowerplayRepository {
  public constructor(private readonly connection: DatabaseSync) {}

  public initialize(): void {
    if (this.connection.prepare('SELECT 1 FROM schema_migrations WHERE version = 31').get()) return
    this.connection.exec('BEGIN IMMEDIATE')
    try {
      this.connection.exec(`
        CREATE TABLE powerplay_entries (entry_id TEXT PRIMARY KEY, occurred_at TEXT NOT NULL,
          kind TEXT NOT NULL, document TEXT NOT NULL) STRICT;
        CREATE INDEX powerplay_entries_time ON powerplay_entries(occurred_at DESC);
        CREATE TABLE powerplay_target (id INTEGER PRIMARY KEY CHECK(id = 1), document TEXT NOT NULL) STRICT;
        DELETE FROM elite_journal_checkpoints;
        INSERT INTO schema_migrations VALUES (31, datetime('now'));
        COMMIT;
      `)
    } catch (cause) { this.connection.exec('ROLLBACK'); throw cause }
  }

  public putEntry(entry: PowerplayEntry): void {
    const record = PowerplayEntrySchema.parse(entry)
    this.connection.prepare(`INSERT INTO powerplay_entries VALUES (?, ?, ?, ?)
      ON CONFLICT(entry_id) DO NOTHING`).run(record.id, record.timestamp, record.kind, JSON.stringify(record))
  }

  public projectionEntries(): PowerplayEntry[] {
    // A startup snapshot or membership change starts a new authoritative projection.
    // Keep later observations in journal order; historical backfill cannot roll it backwards.
    const anchor = this.connection.prepare(`SELECT occurred_at, rowid AS sequence FROM powerplay_entries
      WHERE kind IN ('snapshot', 'join', 'leave', 'defect') ORDER BY occurred_at DESC, rowid DESC LIMIT 1`)
      .get() as { occurred_at: string, sequence: number } | undefined
    const rows = anchor
      ? this.connection.prepare(`SELECT document FROM powerplay_entries
          WHERE occurred_at > ? OR (occurred_at = ? AND rowid >= ?)
          ORDER BY occurred_at, rowid`).all(anchor.occurred_at, anchor.occurred_at, anchor.sequence)
      : this.connection.prepare('SELECT document FROM powerplay_entries ORDER BY occurred_at, rowid').all()
    return (rows as Array<{ document: string }>).map(row => PowerplayEntrySchema.parse(JSON.parse(row.document)))
  }

  public recentEntries(limit: number): PowerplayEntry[] {
    return (this.connection.prepare('SELECT document FROM powerplay_entries ORDER BY occurred_at DESC, rowid DESC LIMIT ?')
      .all(limit) as Array<{ document: string }>).map(row => PowerplayEntrySchema.parse(JSON.parse(row.document)))
  }

  public countEntries(): number {
    return (this.connection.prepare('SELECT count(*) AS count FROM powerplay_entries').get() as { count: number }).count
  }

  public getTarget(): PowerplayTarget | null {
    const row = this.connection.prepare('SELECT document FROM powerplay_target WHERE id = 1').get() as { document: string } | undefined
    return row ? PowerplayTargetSchema.parse(JSON.parse(row.document)) : null
  }

  public setTarget(target: PowerplayTarget | null): void {
    if (target === null) this.connection.exec('DELETE FROM powerplay_target')
    else this.connection.prepare('INSERT INTO powerplay_target VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET document = excluded.document')
      .run(JSON.stringify(PowerplayTargetSchema.parse(target)))
  }
}
