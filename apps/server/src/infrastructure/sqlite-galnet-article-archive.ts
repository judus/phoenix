import { createHash } from 'node:crypto'
import type { DatabaseSync } from 'node:sqlite'
import { GalnetSourceArticleSchema, type GalnetArticleArchive, type GalnetArticleRevision, type GalnetSourceArticle } from '../domain/galnet.js'

const SCHEMA_MIGRATION = 26

interface RevisionRow {
  revision_id: string
  document: string
  first_observed_at: string
  last_observed_at: string
}

export class SqliteGalnetArticleArchive implements GalnetArticleArchive {
  public constructor (private readonly connection: DatabaseSync) {}

  public initialize (): void {
    if (this.connection.prepare('SELECT 1 FROM schema_migrations WHERE version = ?').get(SCHEMA_MIGRATION)) return
    this.connection.exec('BEGIN IMMEDIATE')
    try {
      this.connection.exec(`
        CREATE TABLE galnet_article_revisions (
          article_id TEXT NOT NULL,
          revision_id TEXT NOT NULL,
          document TEXT NOT NULL,
          first_observed_at TEXT NOT NULL,
          last_observed_at TEXT NOT NULL,
          PRIMARY KEY (article_id, revision_id)
        ) STRICT;
        CREATE TABLE galnet_articles (
          article_id TEXT PRIMARY KEY,
          revision_id TEXT NOT NULL,
          FOREIGN KEY (article_id, revision_id) REFERENCES galnet_article_revisions (article_id, revision_id)
        ) STRICT;
        INSERT INTO schema_migrations (version, applied_at) VALUES (${SCHEMA_MIGRATION}, datetime('now'));
        COMMIT;
      `)
    } catch (cause) {
      this.connection.exec('ROLLBACK')
      throw cause
    }
  }

  public observe (articles: GalnetSourceArticle[], observedAt: string): void {
    const documents = articles.map(article => {
      const validated = GalnetSourceArticleSchema.parse(article)
      // Schema parsing fixes field order before hashing; observation times are not content.
      const document = JSON.stringify({ schemaVersion: 1, article: validated })
      return { id: validated.id, document, revisionId: createHash('sha256').update(document).digest('hex') }
    })
    this.connection.exec('BEGIN IMMEDIATE')
    try {
      const insert = this.connection.prepare(`
        INSERT INTO galnet_article_revisions (article_id, revision_id, document, first_observed_at, last_observed_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(article_id, revision_id) DO UPDATE SET last_observed_at = excluded.last_observed_at
      `)
      const current = this.connection.prepare(`
        INSERT INTO galnet_articles (article_id, revision_id) VALUES (?, ?)
        ON CONFLICT(article_id) DO UPDATE SET revision_id = excluded.revision_id
      `)
      for (const entry of documents) {
        insert.run(entry.id, entry.revisionId, entry.document, observedAt, observedAt)
        current.run(entry.id, entry.revisionId)
      }
      this.connection.exec('COMMIT')
    } catch (cause) {
      this.connection.exec('ROLLBACK')
      throw cause
    }
  }

  public getArticle (id: string): GalnetArticleRevision | null {
    const row = this.connection.prepare(`
      SELECT r.revision_id, r.document, r.first_observed_at, r.last_observed_at
      FROM galnet_articles a
      JOIN galnet_article_revisions r ON r.article_id = a.article_id AND r.revision_id = a.revision_id
      WHERE a.article_id = ?
    `).get(id) as RevisionRow | undefined
    return row ? revision(row) : null
  }

  public listRevisions (id: string): GalnetArticleRevision[] {
    const rows = this.connection.prepare(`
      SELECT revision_id, document, first_observed_at, last_observed_at FROM galnet_article_revisions
      WHERE article_id = ? ORDER BY first_observed_at DESC, rowid DESC
    `).all(id) as unknown as RevisionRow[]
    return rows.map(revision)
  }
}

function revision (row: RevisionRow): GalnetArticleRevision {
  const stored = JSON.parse(row.document) as { schemaVersion: number, article: unknown }
  if (stored.schemaVersion !== 1) throw new Error('Unsupported GalNet archive document version.')
  return {
    schemaVersion: 1,
    revisionId: row.revision_id,
    article: GalnetSourceArticleSchema.parse(stored.article),
    firstObservedAt: row.first_observed_at,
    lastObservedAt: row.last_observed_at
  }
}
