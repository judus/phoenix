import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import type {
  EliteJournalCheckpoint,
  EliteJournalCheckpointStore
} from '@phoenix/elite'
import {
  ActivityLogEntrySchema,
  CartographicSystemSchema,
  MissionSchema,
  type ActivityLogEntry,
  type CartographicSystem,
  type DatabaseHealth,
  type Mission
} from '@phoenix/contracts'
import type { CartographyCache } from '../domain/cartography.js'
import type { CartographyObservationStore, LocalSystemCartographyObservation } from '../domain/cartography.js'
import type { Database } from '../domain/database.js'
import type { ActivityLogRepository } from '../domain/elite-journal.js'
import type {
  BiologicalCompletionOverride,
  BiologicalCompletionOverrideRepository
} from '../domain/exploration.js'
import type { ProviderCacheEntry, ProviderResponseCache } from '../domain/station-market.js'
import type { MissionRepository } from '../domain/missions.js'

export class SqliteDatabase implements Database, CartographyCache, CartographyObservationStore, ActivityLogRepository, ProviderResponseCache, BiologicalCompletionOverrideRepository, EliteJournalCheckpointStore, MissionRepository {
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

      CREATE TABLE IF NOT EXISTS exploration_biological_completion_overrides (
        body_key TEXT NOT NULL,
        signal_key TEXT NOT NULL,
        completed_at TEXT NOT NULL,
        PRIMARY KEY (body_key, signal_key)
      ) STRICT;

      CREATE TABLE IF NOT EXISTS elite_journal_checkpoints (
        file_path TEXT PRIMARY KEY,
        byte_offset INTEGER NOT NULL,
        file_size INTEGER NOT NULL,
        updated_at TEXT NOT NULL
      ) STRICT;

      CREATE TABLE IF NOT EXISTS missions (
        mission_id INTEGER PRIMARY KEY,
        status TEXT NOT NULL,
        status_updated_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        document TEXT NOT NULL
      ) STRICT;

      CREATE INDEX IF NOT EXISTS missions_status_updated_at
      ON missions (status, status_updated_at DESC);

      INSERT OR IGNORE INTO schema_migrations (version, applied_at)
      VALUES (2, datetime('now'));

      INSERT OR IGNORE INTO schema_migrations (version, applied_at)
      VALUES (3, datetime('now'));

      INSERT OR IGNORE INTO schema_migrations (version, applied_at)
      VALUES (4, datetime('now'));

      INSERT OR IGNORE INTO schema_migrations (version, applied_at)
      VALUES (5, datetime('now'));

      INSERT OR IGNORE INTO schema_migrations (version, applied_at)
      VALUES (6, datetime('now'));

    `)
    const missionMigration = this.connection.prepare(`
      INSERT OR IGNORE INTO schema_migrations (version, applied_at)
      VALUES (7, datetime('now'))
    `).run()
    if (missionMigration.changes > 0) {
      this.connection.exec('DELETE FROM elite_journal_checkpoints;')
    }
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

  public listObservations (): LocalSystemCartographyObservation[] {
    const rows = this.connection.prepare(`
      SELECT document
      FROM cartographic_observations
      ORDER BY updated_at DESC, system_name ASC
    `).all() as Array<{ document: string }>
    return rows.map(row => JSON.parse(row.document) as LocalSystemCartographyObservation)
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

  public listBiologicalCompletionOverrides (): BiologicalCompletionOverride[] {
    const rows = this.connection.prepare(`
      SELECT body_key, signal_key, completed_at
      FROM exploration_biological_completion_overrides
      ORDER BY completed_at ASC
    `).all() as Array<{ body_key: string, signal_key: string, completed_at: string }>
    return rows.map(row => ({
      bodyKey: row.body_key,
      signalKey: row.signal_key,
      completedAt: row.completed_at
    }))
  }

  public setBiologicalCompletionOverride (bodyKey: string, signalKey: string, completed: boolean): void {
    if (!completed) {
      this.connection.prepare(`
        DELETE FROM exploration_biological_completion_overrides
        WHERE body_key = ? AND signal_key = ?
      `).run(bodyKey, signalKey)
      return
    }
    this.connection.prepare(`
      INSERT INTO exploration_biological_completion_overrides (body_key, signal_key, completed_at)
      VALUES (?, ?, ?)
      ON CONFLICT(body_key, signal_key) DO UPDATE SET completed_at = excluded.completed_at
    `).run(bodyKey, signalKey, new Date().toISOString())
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

  public getJournalCheckpoint (filePath: string): EliteJournalCheckpoint | null {
    const row = this.connection.prepare(`
      SELECT file_path, byte_offset, file_size, updated_at
      FROM elite_journal_checkpoints
      WHERE file_path = ?
    `).get(filePath) as {
      file_path: string
      byte_offset: number
      file_size: number
      updated_at: string
    } | undefined
    return row
      ? {
          byteOffset: row.byte_offset,
          filePath: row.file_path,
          fileSize: row.file_size,
          updatedAt: row.updated_at
        }
      : null
  }

  public putJournalCheckpoint (checkpoint: EliteJournalCheckpoint): void {
    this.connection.prepare(`
      INSERT INTO elite_journal_checkpoints (file_path, byte_offset, file_size, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(file_path) DO UPDATE SET
        byte_offset = excluded.byte_offset,
        file_size = excluded.file_size,
        updated_at = excluded.updated_at
    `).run(
      checkpoint.filePath,
      checkpoint.byteOffset,
      checkpoint.fileSize,
      checkpoint.updatedAt
    )
  }

  public getMission (id: number): Mission | null {
    const row = this.connection.prepare(`
      SELECT document
      FROM missions
      WHERE mission_id = ?
    `).get(id) as { document: string } | undefined
    return row ? MissionSchema.parse(JSON.parse(row.document)) : null
  }

  public listMissions (): Mission[] {
    const rows = this.connection.prepare(`
      SELECT document
      FROM missions
      ORDER BY CASE status WHEN 'active' THEN 0 ELSE 1 END, updated_at DESC, mission_id DESC
    `).all() as Array<{ document: string }>
    return rows.map(row => MissionSchema.parse(JSON.parse(row.document)))
  }

  public putMission (mission: Mission): void {
    const validated = MissionSchema.parse(mission)
    this.connection.prepare(`
      INSERT INTO missions (mission_id, status, status_updated_at, updated_at, document)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(mission_id) DO UPDATE SET
        status = excluded.status,
        status_updated_at = excluded.status_updated_at,
        updated_at = excluded.updated_at,
        document = excluded.document
    `).run(
      validated.id,
      validated.status,
      validated.statusUpdatedAt,
      validated.updatedAt,
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
