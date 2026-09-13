import type { DatabaseSync } from 'node:sqlite'
import { SavedGalaxyQuerySchema, type SavedGalaxyQuery } from '@phoenix/contracts'
import type { SavedGalaxyQueryRepository } from '../domain/saved-galaxy-queries.js'

const TABLE_MIGRATION = 17
const DOCUMENT_MIGRATION = 20

export class SqliteSavedGalaxyQueryRepository implements SavedGalaxyQueryRepository {
  public constructor (private readonly connection: DatabaseSync) {}

  public initialize (): void {
    this.createTable()
    this.migrateDocuments()
  }

  public deleteSavedGalaxyQuery (id: string): void {
    this.connection.prepare('DELETE FROM saved_galaxy_queries WHERE query_id = ?').run(id)
  }

  public getSavedGalaxyQuery (id: string): SavedGalaxyQuery | null {
    const row = this.connection.prepare('SELECT document FROM saved_galaxy_queries WHERE query_id = ?')
      .get(id) as { document: string } | undefined
    return row ? SavedGalaxyQuerySchema.parse(JSON.parse(row.document)) : null
  }

  public listSavedGalaxyQueries (): SavedGalaxyQuery[] {
    const rows = this.connection.prepare(`
      SELECT document FROM saved_galaxy_queries ORDER BY updated_at DESC, query_id ASC
    `).all() as Array<{ document: string }>
    return rows.map(row => SavedGalaxyQuerySchema.parse(JSON.parse(row.document)))
  }

  public putSavedGalaxyQuery (query: SavedGalaxyQuery): void {
    const validated = SavedGalaxyQuerySchema.parse(query)
    this.connection.prepare(`
      INSERT INTO saved_galaxy_queries (query_id, updated_at, document)
      VALUES (?, ?, ?)
      ON CONFLICT(query_id) DO UPDATE SET
        updated_at = excluded.updated_at,
        document = excluded.document
    `).run(validated.id, validated.updatedAt, JSON.stringify(validated))
  }

  private createTable (): void {
    if (this.connection.prepare('SELECT 1 FROM schema_migrations WHERE version = ?').get(TABLE_MIGRATION)) return
    this.connection.exec('BEGIN IMMEDIATE')
    try {
      this.connection.exec(`
        CREATE TABLE saved_galaxy_queries (
          query_id TEXT PRIMARY KEY,
          updated_at TEXT NOT NULL,
          document TEXT NOT NULL
        ) STRICT;
        CREATE INDEX saved_galaxy_queries_updated_at
        ON saved_galaxy_queries (updated_at DESC);
        INSERT INTO schema_migrations (version, applied_at)
        VALUES (${TABLE_MIGRATION}, datetime('now'));
        COMMIT;
      `)
    } catch (cause) {
      this.connection.exec('ROLLBACK')
      throw cause
    }
  }

  private migrateDocuments (): void {
    if (this.connection.prepare('SELECT 1 FROM schema_migrations WHERE version = ?').get(DOCUMENT_MIGRATION)) return
    this.connection.exec('BEGIN IMMEDIATE')
    try {
      const rows = this.connection.prepare('SELECT query_id, document FROM saved_galaxy_queries')
        .all() as Array<{ query_id: string, document: string }>
      const update = this.connection.prepare('UPDATE saved_galaxy_queries SET document = ? WHERE query_id = ?')
      for (const row of rows) {
        const candidate = JSON.parse(row.document) as Record<string, unknown>
        const migrated = candidate.schemaVersion === 1
          ? { ...candidate, schemaVersion: 2, useOnDashboard: false }
          : candidate
        const validated = SavedGalaxyQuerySchema.parse(migrated)
        update.run(JSON.stringify(validated), row.query_id)
      }
      this.connection.exec(`
        INSERT INTO schema_migrations (version, applied_at)
        VALUES (${DOCUMENT_MIGRATION}, datetime('now'));
        COMMIT;
      `)
    } catch (cause) {
      this.connection.exec('ROLLBACK')
      throw cause
    }
  }
}
