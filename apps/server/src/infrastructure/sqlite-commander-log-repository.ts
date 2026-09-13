import type { DatabaseSync } from 'node:sqlite'
import {
  CommanderLogEntrySchema,
  type CommanderLogEntry
} from '@phoenix/contracts'
import type { CommanderLogRepository } from '../domain/commander-log.js'

const SCHEMA_MIGRATION = 18

export class SqliteCommanderLogRepository implements CommanderLogRepository {
  public constructor (private readonly connection: DatabaseSync) {}

  public initialize (): void {
    const applied = this.connection.prepare(
      'SELECT 1 FROM schema_migrations WHERE version = ?'
    ).get(SCHEMA_MIGRATION)
    if (applied) return

    this.connection.exec('BEGIN IMMEDIATE')
    try {
      this.connection.exec(`
        CREATE TABLE commander_log (
          entry_id TEXT PRIMARY KEY,
          occurred_at TEXT NOT NULL,
          category TEXT NOT NULL,
          kind TEXT NOT NULL,
          document TEXT NOT NULL
        ) STRICT;
        CREATE INDEX commander_log_occurred_at
        ON commander_log (occurred_at DESC);
        CREATE INDEX commander_log_category_occurred_at
        ON commander_log (category, occurred_at DESC);
        DELETE FROM elite_journal_checkpoints;
        INSERT INTO schema_migrations (version, applied_at)
        VALUES (${SCHEMA_MIGRATION}, datetime('now'));
        COMMIT;
      `)
    } catch (cause) {
      this.connection.exec('ROLLBACK')
      throw cause
    }
  }

  public getRecentCommanderLogEntries (limit: number): CommanderLogEntry[] {
    const rows = this.connection.prepare(`
      SELECT document
      FROM commander_log
      ORDER BY occurred_at DESC, entry_id DESC
      LIMIT ?
    `).all(limit) as Array<{ document: string }>
    return rows.map(row => CommanderLogEntrySchema.parse(JSON.parse(row.document)))
  }

  public countCommanderLogEntries (): number {
    const row = this.connection.prepare('SELECT COUNT(*) AS count FROM commander_log').get() as { count: number }
    return row.count
  }

  public putCommanderLogEntry (entry: CommanderLogEntry): void {
    const validated = CommanderLogEntrySchema.parse(entry)
    this.connection.prepare(`
      INSERT INTO commander_log (entry_id, occurred_at, category, kind, document)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(entry_id) DO UPDATE SET
        occurred_at = excluded.occurred_at,
        category = excluded.category,
        kind = excluded.kind,
        document = excluded.document
    `).run(
      validated.id,
      validated.timestamp,
      validated.category,
      validated.kind,
      JSON.stringify(validated)
    )
  }
}
