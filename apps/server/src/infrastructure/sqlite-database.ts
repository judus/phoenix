import { dirname } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import type {
  EliteJournalCheckpoint,
  EliteJournalCheckpointStore
} from '@phoenix/elite'
import {
  ActivityLogEntrySchema,
  CartographicSystemSchema,
  CommunicationMessageSchema,
  GalaxyBookmarkSchema,
  MissionRecordSchema,
  type ActivityLogEntry,
  type CartographicSystem,
  type CommunicationMessage,
  type DatabaseHealth,
  type GalaxyBookmark,
  type MissionRecord
} from '@phoenix/contracts'
import type {
  CartographyRecord,
  CartographyRepository,
  LocalSystemCartographyObservation
} from '../domain/cartography.js'
import type { Database } from '../domain/database.js'
import type { ActivityLogRepository } from '../domain/elite-journal.js'
import type {
  BiologicalCompletionOverride,
  BiologicalCompletionOverrideRepository
} from '../domain/exploration.js'
import type { ProviderCacheEntry, ProviderResponseCache } from '../domain/station-market.js'
import type { MissionRepository } from '../domain/missions.js'
import type { CommunicationQueryView, CommunicationRepository } from '../domain/communications.js'
import { galaxyBookmarkTargetKey, type GalaxyBookmarkRepository } from '../domain/galaxy-bookmarks.js'
import { edsmBodyDetails } from './edsm-cartography-source.js'
import { ensurePrivateDirectorySync, restrictPrivateFileSync } from './private-user-state.js'
import { parseStoredCartographyObservation, upgradeStoredCartographyObservation } from './stored-cartography-observation.js'
import { SqliteCommanderLogRepository } from './sqlite-commander-log-repository.js'
import { SqliteCommanderEquipmentRepository } from './sqlite-commander-equipment-repository.js'
import { SqliteEngineeringProjectRepository } from './sqlite-engineering-project-repository.js'
import { SqliteSavedGalaxyQueryRepository } from './sqlite-saved-galaxy-query-repository.js'
import { SqliteEddnOutbox } from './sqlite-eddn-outbox.js'
import { SqliteFleetRepository } from './sqlite-fleet-repository.js'
import { SqliteGalnetArticleArchive } from './sqlite-galnet-article-archive.js'
import { SqliteGalnetAnalysisRepository } from './sqlite-galnet-analysis-repository.js'
import { SqliteGalnetBackgroundRepository } from './sqlite-galnet-background-repository.js'
import { SqlitePersonalNoteRepository } from './sqlite-personal-note-repository.js'
import { SqlitePowerplayRepository } from './sqlite-powerplay-repository.js'
import { SqliteColonisationRepository } from './sqlite-colonisation-repository.js'
import { SqliteCarrierRepository } from './sqlite-carrier-repository.js'

export class SqliteDatabase implements Database, CartographyRepository, ActivityLogRepository, ProviderResponseCache, BiologicalCompletionOverrideRepository, EliteJournalCheckpointStore, MissionRepository, CommunicationRepository, GalaxyBookmarkRepository {
  public readonly fleet: SqliteFleetRepository
  public readonly eddnOutbox: SqliteEddnOutbox
  public readonly commanderEquipment: SqliteCommanderEquipmentRepository
  public readonly commanderLog: SqliteCommanderLogRepository
  public readonly engineeringProjects: SqliteEngineeringProjectRepository
  public readonly savedGalaxyQueries: SqliteSavedGalaxyQueryRepository
  public readonly galnetArchive: SqliteGalnetArticleArchive
  public readonly galnetAnalyses: SqliteGalnetAnalysisRepository
  public readonly galnetBackground: SqliteGalnetBackgroundRepository
  public readonly personalNotes: SqlitePersonalNoteRepository
  public readonly powerplay: SqlitePowerplayRepository
  public readonly colonisation: SqliteColonisationRepository
  public readonly carriers: SqliteCarrierRepository
  private readonly connection: DatabaseSync
  private readonly path: string

  public constructor (path: string) {
    this.path = path
    if (path !== ':memory:') ensurePrivateDirectorySync(dirname(path))
    this.connection = new DatabaseSync(path)
    this.fleet = new SqliteFleetRepository(this.connection)
    this.eddnOutbox = new SqliteEddnOutbox(this.connection)
    this.commanderEquipment = new SqliteCommanderEquipmentRepository(this.connection)
    this.commanderLog = new SqliteCommanderLogRepository(this.connection)
    this.engineeringProjects = new SqliteEngineeringProjectRepository(this.connection)
    this.savedGalaxyQueries = new SqliteSavedGalaxyQueryRepository(this.connection)
    this.personalNotes = new SqlitePersonalNoteRepository(this.connection)
    this.powerplay = new SqlitePowerplayRepository(this.connection)
    this.colonisation = new SqliteColonisationRepository(this.connection)
    this.carriers = new SqliteCarrierRepository(this.connection)
    this.galnetArchive = new SqliteGalnetArticleArchive(this.connection)
    this.galnetAnalyses = new SqliteGalnetAnalysisRepository(this.connection)
    this.galnetBackground = new SqliteGalnetBackgroundRepository(this.connection)
    this.restrictFiles()
  }

  public initialize (): boolean {
    const newProfile = !this.connection.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations'").get()
    // Journal mode must change outside a transaction. Batch base DDL to avoid a durable
    // commit per statement; later data migrations keep their own commit/rollback boundaries.
    this.connection.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;')
    this.connection.exec('BEGIN IMMEDIATE')
    try {
      this.connection.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      ) STRICT;

      INSERT OR IGNORE INTO schema_migrations (version, applied_at)
      VALUES (1, datetime('now'));

      CREATE TABLE IF NOT EXISTS cartography_records (
        system_key TEXT PRIMARY KEY,
        system_name TEXT NOT NULL,
        external_fetched_at TEXT,
        local_updated_at TEXT,
        external_document TEXT,
        local_document TEXT,
        CHECK (external_document IS NOT NULL OR local_document IS NOT NULL),
        CHECK ((external_fetched_at IS NULL) = (external_document IS NULL)),
        CHECK ((local_updated_at IS NULL) = (local_document IS NULL))
      ) STRICT;

      CREATE INDEX IF NOT EXISTS cartography_records_external_fetched_at
      ON cartography_records (external_fetched_at);

      CREATE INDEX IF NOT EXISTS cartography_records_local_updated_at
      ON cartography_records (local_updated_at);

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

      CREATE TABLE IF NOT EXISTS mission_projection_state (
        state_key TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL
      ) STRICT;

      CREATE TABLE IF NOT EXISTS communications (
        message_id TEXT PRIMARY KEY,
        occurred_at TEXT NOT NULL,
        direction TEXT NOT NULL,
        view TEXT NOT NULL,
        channel TEXT NOT NULL,
        sender_kind TEXT NOT NULL,
        document TEXT NOT NULL
      ) STRICT;

      CREATE INDEX IF NOT EXISTS communications_view_occurred_at
      ON communications (view, occurred_at DESC);

      CREATE TABLE IF NOT EXISTS fleet_ships (
        ship_id INTEGER PRIMARY KEY,
        state TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        document TEXT NOT NULL
      ) STRICT;

      CREATE INDEX IF NOT EXISTS fleet_ships_state
      ON fleet_ships (state, updated_at DESC);

      CREATE TABLE IF NOT EXISTS fleet_stored_modules (
        storage_slot INTEGER PRIMARY KEY,
        updated_at TEXT NOT NULL,
        document TEXT NOT NULL
      ) STRICT;

      CREATE TABLE IF NOT EXISTS fleet_projection_state (
        state_key TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL
      ) STRICT;

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
      this.connection.exec('COMMIT')
    } catch (cause) {
      this.connection.exec('ROLLBACK')
      throw cause
    }
    this.restrictFiles()
    const missionMigration = this.connection.prepare(`
      INSERT OR IGNORE INTO schema_migrations (version, applied_at)
      VALUES (7, datetime('now'))
    `).run()
    if (missionMigration.changes > 0) {
      this.connection.exec('DELETE FROM elite_journal_checkpoints;')
    }
    const communicationsMigration = this.connection.prepare(`
      INSERT OR IGNORE INTO schema_migrations (version, applied_at)
      VALUES (8, datetime('now'))
    `).run()
    if (communicationsMigration.changes > 0) {
      this.connection.exec('DELETE FROM elite_journal_checkpoints;')
    }
    const fleetMigration = this.connection.prepare(`
      INSERT OR IGNORE INTO schema_migrations (version, applied_at)
      VALUES (9, datetime('now'))
    `).run()
    if (fleetMigration.changes > 0) {
      this.connection.exec('DELETE FROM elite_journal_checkpoints;')
    }
    const missionProvenanceMigration = this.connection.prepare(`
      INSERT OR IGNORE INTO schema_migrations (version, applied_at)
      VALUES (10, datetime('now'))
    `).run()
    if (missionProvenanceMigration.changes > 0) {
      this.connection.exec('DELETE FROM elite_journal_checkpoints;')
    }
    this.migrateCartographyRecords()
    this.migrateExternalCartographyDocuments(12)
    this.migrateCartographyObservationMeaning()
    this.migrateExternalCartographyDocuments(14)
    this.migrateExternalCartographyDocuments(15)
    this.migrateGalaxyBookmarks()
    this.migrateCartographyCoordinates()
    this.migrateMissionDetails()
    const equipmentProjectionCreated = this.commanderEquipment.initialize()
    if (equipmentProjectionCreated) this.connection.exec('DELETE FROM elite_journal_checkpoints;')
    this.commanderLog.initialize()
    this.engineeringProjects.initialize()
    this.savedGalaxyQueries.initialize()
    this.personalNotes.initialize()
    this.galnetArchive.initialize()
    this.galnetAnalyses.initialize()
    this.galnetBackground.initialize()
    this.powerplay.initialize()
    this.colonisation.initialize()
    this.carriers.initialize()
    return newProfile
  }

  public findRecord (systemName: string): CartographyRecord | null {
    const row = this.connection.prepare(`
      SELECT system_name, external_document, local_document
      FROM cartography_records
      WHERE system_key = ?
    `).get(systemKey(systemName)) as {
      system_name: string
      external_document: string | null
      local_document: string | null
    } | undefined
    return row ? cartographyRecord(row) : null
  }

  public listObservedRecords (): CartographyRecord[] {
    const rows = this.connection.prepare(`
      SELECT system_name, external_document, local_document
      FROM cartography_records
      WHERE local_document IS NOT NULL
      ORDER BY local_updated_at DESC, system_name ASC
    `).all() as Array<{
      system_name: string
      external_document: string | null
      local_document: string | null
    }>
    return rows.map(cartographyRecord)
  }

  public putExternalSystem (system: CartographicSystem): void {
    const validated = CartographicSystemSchema.parse(system)
    const fetchedAt = validated.provenance.edsm?.fetchedAt
    if (!fetchedAt) throw new Error('External cartography requires EDSM provenance.')
    this.connection.prepare(`
      INSERT INTO cartography_records (system_key, system_name, external_fetched_at, external_document)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(system_key) DO UPDATE SET
        system_name = excluded.system_name,
        external_fetched_at = excluded.external_fetched_at,
        external_document = excluded.external_document
    `).run(
      systemKey(validated.name),
      validated.name,
      fetchedAt,
      JSON.stringify(validated)
    )
  }

  public putLocalObservation (observation: LocalSystemCartographyObservation): void {
    this.connection.prepare(`
      INSERT INTO cartography_records (system_key, system_name, local_updated_at, local_document)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(system_key) DO UPDATE SET
        system_name = excluded.system_name,
        local_updated_at = excluded.local_updated_at,
        local_document = excluded.local_document
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

  public getMission (id: number): MissionRecord | null {
    const row = this.connection.prepare(`
      SELECT document
      FROM missions
      WHERE mission_id = ?
    `).get(id) as { document: string } | undefined
    return row ? MissionRecordSchema.parse(JSON.parse(row.document)) : null
  }

  public getMissionProjectionTimestamp (key: string): string | null {
    const row = this.connection.prepare(`
      SELECT timestamp FROM mission_projection_state WHERE state_key = ?
    `).get(key) as { timestamp: string } | undefined
    return row?.timestamp ?? null
  }

  public listMissions (): MissionRecord[] {
    const rows = this.connection.prepare(`
      SELECT document
      FROM missions
      ORDER BY CASE status WHEN 'active' THEN 0 ELSE 1 END, updated_at DESC, mission_id DESC
    `).all() as Array<{ document: string }>
    return rows.map(row => MissionRecordSchema.parse(JSON.parse(row.document)))
  }

  public putMission (mission: MissionRecord): void {
    const validated = MissionRecordSchema.parse(mission)
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

  public putMissionProjectionTimestamp (key: string, timestamp: string): void {
    this.connection.prepare(`
      INSERT INTO mission_projection_state (state_key, timestamp)
      VALUES (?, ?)
      ON CONFLICT(state_key) DO UPDATE SET timestamp = excluded.timestamp
      WHERE excluded.timestamp >= mission_projection_state.timestamp
    `).run(key, timestamp)
  }

  private migrateMissionDetails (): void {
    if (this.connection.prepare('SELECT 1 FROM schema_migrations WHERE version = 30').get()) return
    this.connection.exec(`
      BEGIN;
      UPDATE missions SET document = json_set(document,
        '$.commodityId', NULL, '$.targetTypeId', NULL,
        '$.receivedRewards', NULL,
        '$.reward', CASE WHEN json_extract(document, '$.provenance.terminalObserved') = 1
          THEN NULL ELSE json_extract(document, '$.reward') END);
      DELETE FROM elite_journal_checkpoints;
      INSERT INTO schema_migrations (version, applied_at) VALUES (30, datetime('now'));
      COMMIT;
    `)
  }

  public listCommunicationMessages (view: CommunicationQueryView, limit: number): CommunicationMessage[] {
    const rows = view === 'all'
      ? this.connection.prepare(`
          SELECT document FROM communications
          ORDER BY occurred_at DESC, message_id DESC
          LIMIT ?
        `).all(limit) as Array<{ document: string }>
      : this.connection.prepare(`
          SELECT document FROM communications
          WHERE view = ?
          ORDER BY occurred_at DESC, message_id DESC
          LIMIT ?
        `).all(view, limit) as Array<{ document: string }>
    return rows.map(row => CommunicationMessageSchema.parse(JSON.parse(row.document)))
  }

  public putCommunicationMessage (message: CommunicationMessage): void {
    const validated = CommunicationMessageSchema.parse(message)
    this.connection.prepare(`
      INSERT OR IGNORE INTO communications (
        message_id, occurred_at, direction, view, channel, sender_kind, document
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      validated.id,
      validated.timestamp,
      validated.direction,
      validated.view,
      validated.channel,
      validated.senderKind,
      JSON.stringify(validated)
    )
  }

  public summarizeCommunications (view: CommunicationQueryView): {
    inbound: number
    inbox: number
    outbound: number
    total: number
    traffic: number
  } {
    const row = this.connection.prepare(`
      SELECT
        SUM(CASE WHEN ? = 'all' OR view = ? THEN 1 ELSE 0 END) AS total,
        SUM(CASE WHEN view = 'inbox' THEN 1 ELSE 0 END) AS inbox,
        SUM(CASE WHEN view = 'traffic' THEN 1 ELSE 0 END) AS traffic,
        SUM(CASE WHEN (? = 'all' OR view = ?) AND direction = 'inbound' THEN 1 ELSE 0 END) AS inbound,
        SUM(CASE WHEN (? = 'all' OR view = ?) AND direction = 'outbound' THEN 1 ELSE 0 END) AS outbound
      FROM communications
    `).get(view, view, view, view, view, view) as Record<'inbound' | 'inbox' | 'outbound' | 'total' | 'traffic', number | null>
    return {
      inbound: row.inbound ?? 0,
      inbox: row.inbox ?? 0,
      outbound: row.outbound ?? 0,
      total: row.total ?? 0,
      traffic: row.traffic ?? 0
    }
  }

  public deleteGalaxyBookmark (id: string): void {
    this.connection.prepare('DELETE FROM galaxy_bookmarks WHERE bookmark_id = ?').run(id)
  }

  public findGalaxyBookmarkByTarget (target: GalaxyBookmark['target']): GalaxyBookmark | null {
    const row = this.connection.prepare(`
      SELECT document FROM galaxy_bookmarks WHERE target_key = ?
    `).get(galaxyBookmarkTargetKey(target)) as { document: string } | undefined
    return row ? GalaxyBookmarkSchema.parse(JSON.parse(row.document)) : null
  }

  public getGalaxyBookmark (id: string): GalaxyBookmark | null {
    const row = this.connection.prepare(`
      SELECT document FROM galaxy_bookmarks WHERE bookmark_id = ?
    `).get(id) as { document: string } | undefined
    return row ? GalaxyBookmarkSchema.parse(JSON.parse(row.document)) : null
  }

  public listGalaxyBookmarks (): GalaxyBookmark[] {
    const rows = this.connection.prepare(`
      SELECT document FROM galaxy_bookmarks ORDER BY updated_at DESC, bookmark_id ASC
    `).all() as Array<{ document: string }>
    return rows.map(row => GalaxyBookmarkSchema.parse(JSON.parse(row.document)))
  }

  public putGalaxyBookmark (bookmark: GalaxyBookmark): void {
    const validated = GalaxyBookmarkSchema.parse(bookmark)
    this.connection.prepare(`
      INSERT INTO galaxy_bookmarks (bookmark_id, target_key, updated_at, document)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(bookmark_id) DO UPDATE SET
        target_key = excluded.target_key,
        updated_at = excluded.updated_at,
        document = excluded.document
    `).run(
      validated.id,
      galaxyBookmarkTargetKey(validated.target),
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

  private migrateCartographyRecords (): void {
    const applied = this.connection.prepare('SELECT 1 FROM schema_migrations WHERE version = 11').get()
    if (applied) return
    this.connection.exec('BEGIN IMMEDIATE')
    try {
      if (this.tableExists('cartographic_systems')) {
        const rows = this.connection.prepare(`
          SELECT system_name, fetched_at, document
          FROM cartographic_systems
        `).all() as Array<{ system_name: string, fetched_at: string, document: string }>
        for (const row of rows) {
          const external = upgradeExternalSystem(row.document, row.fetched_at)
          this.putExternalSystem(external)
        }
      }
      if (this.tableExists('cartographic_observations')) {
        const rows = this.connection.prepare(`
          SELECT document
          FROM cartographic_observations
        `).all() as Array<{ document: string }>
        for (const row of rows) this.putLocalObservation(upgradeStoredCartographyObservation(row.document))
      }
      this.connection.exec(`
        DROP TABLE IF EXISTS cartographic_systems;
        DROP TABLE IF EXISTS cartographic_observations;
        INSERT INTO schema_migrations (version, applied_at) VALUES (11, datetime('now'));
        COMMIT;
      `)
    } catch (cause) {
      this.connection.exec('ROLLBACK')
      throw cause
    }
  }

  private migrateExternalCartographyDocuments (version: 12 | 14 | 15): void {
    const applied = this.connection.prepare('SELECT 1 FROM schema_migrations WHERE version = ?').get(version)
    if (applied) return
    this.connection.exec('BEGIN IMMEDIATE')
    try {
      const rows = this.connection.prepare(`
        SELECT external_fetched_at, external_document
        FROM cartography_records
        WHERE external_document IS NOT NULL
      `).all() as Array<{ external_fetched_at: string, external_document: string }>
      for (const row of rows) {
        this.putExternalSystem(upgradeExternalSystem(row.external_document, row.external_fetched_at))
      }
      this.connection.prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (?, datetime('now'))").run(version)
      this.connection.exec('COMMIT')
    } catch (cause) {
      this.connection.exec('ROLLBACK')
      throw cause
    }
  }

  private migrateCartographyObservationMeaning (): void {
    const applied = this.connection.prepare('SELECT 1 FROM schema_migrations WHERE version = 13').get()
    if (applied) return
    this.connection.exec('BEGIN IMMEDIATE')
    try {
      const rows = this.connection.prepare(`
        SELECT local_document
        FROM cartography_records
        WHERE local_document IS NOT NULL
      `).all() as Array<{ local_document: string }>
      for (const row of rows) {
        this.putLocalObservation(upgradeStoredCartographyObservation(row.local_document))
      }
      this.connection.exec(`
        INSERT INTO schema_migrations (version, applied_at) VALUES (13, datetime('now'));
        COMMIT;
      `)
    } catch (cause) {
      this.connection.exec('ROLLBACK')
      throw cause
    }
  }

  private migrateCartographyCoordinates (): void {
    if (this.connection.prepare('SELECT 1 FROM schema_migrations WHERE version = 25').get()) return
    this.connection.exec('BEGIN IMMEDIATE')
    try {
      const rows = this.connection.prepare('SELECT local_document FROM cartography_records WHERE local_document IS NOT NULL').all() as Array<{ local_document: string }>
      for (const row of rows) this.putLocalObservation(upgradeStoredCartographyObservation(row.local_document))
      // Rebuild through normal journal ingestion, rather than a separate coordinate recovery path.
      this.connection.exec(`
        DELETE FROM elite_journal_checkpoints;
        INSERT INTO schema_migrations (version, applied_at) VALUES (25, datetime('now'));
        COMMIT;
      `)
    } catch (cause) {
      this.connection.exec('ROLLBACK')
      throw cause
    }
  }

  private migrateGalaxyBookmarks (): void {
    const applied = this.connection.prepare('SELECT 1 FROM schema_migrations WHERE version = 16').get()
    if (applied) return
    this.connection.exec('BEGIN IMMEDIATE')
    try {
      this.connection.exec(`
        CREATE TABLE galaxy_bookmarks (
          bookmark_id TEXT PRIMARY KEY,
          target_key TEXT NOT NULL UNIQUE,
          updated_at TEXT NOT NULL,
          document TEXT NOT NULL
        ) STRICT;
        CREATE INDEX galaxy_bookmarks_updated_at
        ON galaxy_bookmarks (updated_at DESC);
        INSERT INTO schema_migrations (version, applied_at) VALUES (16, datetime('now'));
        COMMIT;
      `)
    } catch (cause) {
      this.connection.exec('ROLLBACK')
      throw cause
    }
  }

  private tableExists (name: string): boolean {
    return this.connection.prepare(`
      SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?
    `).get(name) !== undefined
  }

  private restrictFiles (): void {
    if (this.path === ':memory:') return
    restrictPrivateFileSync(this.path)
    restrictPrivateFileSync(`${this.path}-shm`)
    restrictPrivateFileSync(`${this.path}-wal`)
  }
}

function cartographyRecord (row: {
  system_name: string
  external_document: string | null
  local_document: string | null
}): CartographyRecord {
  return {
    systemName: row.system_name,
    external: row.external_document ? CartographicSystemSchema.parse(JSON.parse(row.external_document)) : null,
    local: row.local_document ? parseStoredCartographyObservation(row.local_document) : null
  }
}

function upgradeExternalSystem (document: string, fetchedAt: string): CartographicSystem {
  const candidate = JSON.parse(document) as Record<string, unknown>
  const { source: _source, ...system } = candidate
  const bodies = Array.isArray(candidate.bodies)
    ? candidate.bodies.map(value => {
        if (value === null || typeof value !== 'object' || Array.isArray(value)) return value
        const body = value as Record<string, unknown>
        const raw = body.raw !== null && typeof body.raw === 'object' && !Array.isArray(body.raw)
          ? body.raw as Record<string, unknown>
          : {}
        return { ...body, ...edsmBodyDetails(raw) }
      })
    : candidate.bodies
  return CartographicSystemSchema.parse({
    ...system,
    bodies,
    schemaVersion: 5,
    provenance: { edsm: { fetchedAt }, journal: null }
  })
}

function systemKey (systemName: string): string {
  return systemName.trim().toLocaleLowerCase()
}
