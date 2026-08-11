import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import {
  ActivityLogEntrySchema,
  CartographicSystemSchema,
  type ActivityLogEntry,
  type CartographicSystem,
  type DatabaseHealth
} from '@phoenix/contracts'
import type { CartographyCache } from '../domain/cartography.js'
import type { CartographyObservationStore, LocalSystemCartographyObservation } from '../domain/cartography.js'
import type { Database } from '../domain/database.js'
import type { ActivityLogRepository } from '../domain/elite-journal.js'
import type { ProviderCacheEntry, ProviderResponseCache } from '../domain/station-market.js'

export class SqliteDatabase implements Database, CartographyCache, CartographyObservationStore, ActivityLogRepository, ProviderResponseCache {
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

      CREATE TABLE IF NOT EXISTS cartographic_systems (
        system_key TEXT PRIMARY KEY,
        system_name TEXT NOT NULL,
        fetched_at TEXT NOT NULL,
        document TEXT NOT NULL
      ) STRICT;

      CREATE INDEX IF NOT EXISTS cartographic_systems_fetched_at
      ON cartographic_systems (fetched_at);

      CREATE TABLE IF NOT EXISTS cartographic_observations (
        system_key TEXT PRIMARY KEY,
        system_name TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        document TEXT NOT NULL
      ) STRICT;

      CREATE TABLE IF NOT EXISTS activity_log (
        id TEXT PRIMARY KEY,
        occurred_at TEXT NOT NULL,
        ingested_at TEXT NOT NULL,
        source TEXT NOT NULL,
        event TEXT NOT NULL,
        importance TEXT NOT NULL,
        actionable INTEGER NOT NULL,
        document TEXT NOT NULL
      ) STRICT;

      CREATE INDEX IF NOT EXISTS activity_log_occurred_at
      ON activity_log (occurred_at DESC);

      CREATE INDEX IF NOT EXISTS activity_log_source_event
      ON activity_log (source, event, occurred_at DESC);

      CREATE TABLE IF NOT EXISTS provider_response_cache (
        namespace TEXT NOT NULL,
        cache_key TEXT NOT NULL,
        fetched_at TEXT NOT NULL,
        document TEXT NOT NULL,
        PRIMARY KEY (namespace, cache_key)
      ) STRICT;

      CREATE INDEX IF NOT EXISTS provider_response_cache_fetched_at
      ON provider_response_cache (fetched_at);

      INSERT OR IGNORE INTO schema_migrations (version, applied_at)
      VALUES (2, datetime('now'));

      INSERT OR IGNORE INTO schema_migrations (version, applied_at)
      VALUES (3, datetime('now'));

      INSERT OR IGNORE INTO schema_migrations (version, applied_at)
      VALUES (4, datetime('now'));
    `)
  }

  public getSystem (systemName: string): CartographicSystem | null {
    const row = this.connection.prepare(`
      SELECT document
      FROM cartographic_systems
      WHERE system_key = ?
    `).get(systemKey(systemName)) as { document: string } | undefined
    return row ? CartographicSystemSchema.parse(JSON.parse(row.document)) : null
  }

  public putSystem (system: CartographicSystem): void {
    const validated = CartographicSystemSchema.parse(system)
    this.connection.prepare(`
      INSERT INTO cartographic_systems (system_key, system_name, fetched_at, document)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(system_key) DO UPDATE SET
        system_name = excluded.system_name,
        fetched_at = excluded.fetched_at,
        document = excluded.document
    `).run(
      systemKey(validated.name),
      validated.name,
      validated.source.fetchedAt,
      JSON.stringify(validated)
    )
  }

  public getObservation (systemName: string): LocalSystemCartographyObservation | null {
    const row = this.connection.prepare(`
      SELECT document
      FROM cartographic_observations
      WHERE system_key = ?
    `).get(systemKey(systemName)) as { document: string } | undefined
    return row ? JSON.parse(row.document) as LocalSystemCartographyObservation : null
  }

  public putObservation (observation: LocalSystemCartographyObservation): void {
    this.connection.prepare(`
      INSERT INTO cartographic_observations (system_key, system_name, updated_at, document)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(system_key) DO UPDATE SET
        system_name = excluded.system_name,
        updated_at = excluded.updated_at,
        document = excluded.document
    `).run(
      systemKey(observation.systemName),
      observation.systemName,
      observation.updatedAt,
      JSON.stringify(observation)
    )
  }

  public getRecentActivity (limit: number): ActivityLogEntry[] {
    const rows = this.connection.prepare(`
      SELECT document
      FROM activity_log
      ORDER BY occurred_at DESC, ingested_at DESC
      LIMIT ?
    `).all(limit) as Array<{ document: string }>
    return rows.map(row => ActivityLogEntrySchema.parse(JSON.parse(row.document)))
  }

  public putActivity (entry: ActivityLogEntry): void {
    const validated = ActivityLogEntrySchema.parse(entry)
    this.connection.prepare(`
      INSERT OR IGNORE INTO activity_log (
        id, occurred_at, ingested_at, source, event, importance, actionable, document
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      validated.id,
      validated.timestamp,
      validated.ingestedAt,
      validated.source,
      validated.event,
      validated.importance,
      validated.actionable ? 1 : 0,
      JSON.stringify(validated)
    )
  }

  public getProviderResponse (namespace: string, key: string): ProviderCacheEntry | null {
    const row = this.connection.prepare(`
      SELECT fetched_at, document
      FROM provider_response_cache
      WHERE namespace = ? AND cache_key = ?
    `).get(namespace, key) as { fetched_at: string, document: string } | undefined
    return row ? { fetchedAt: row.fetched_at, value: JSON.parse(row.document) as unknown } : null
  }

  public putProviderResponse (namespace: string, key: string, fetchedAt: string, value: unknown): void {
    this.connection.prepare(`
      INSERT INTO provider_response_cache (namespace, cache_key, fetched_at, document)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(namespace, cache_key) DO UPDATE SET
        fetched_at = excluded.fetched_at,
        document = excluded.document
    `).run(namespace, key, fetchedAt, JSON.stringify(value))
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

function systemKey (systemName: string): string {
  return systemName.trim().toLocaleLowerCase()
}
