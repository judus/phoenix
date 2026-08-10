import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import type { DatabaseHealth } from '@phoenix/contracts'
import type { Database } from '../domain/database.js'

export class SqliteDatabase implements Database {
  private readonly connection: DatabaseSync

  public constructor (path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true })
    this.connection = new DatabaseSync(path)
  }

  public initialize (): void {
    this.connection.exec(`
      PRAGMA foreign_keys = ON;
      PRAGMA journal_mode = WAL;

      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      ) STRICT;

      INSERT OR IGNORE INTO schema_migrations (version, applied_at)
      VALUES (1, datetime('now'));
    `)
  }

  public health (): DatabaseHealth {
    const row = this.connection.prepare('SELECT 1 AS connected').get() as { connected: number }
    return {
      connected: row.connected === 1,
      engine: 'sqlite'
    }
  }

  public close (): void {
    if (this.connection.isOpen) this.connection.close()
  }
}

