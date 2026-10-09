import type { DatabaseSync } from 'node:sqlite'
import { GalnetAnalysisSchema, type GalnetAnalysis } from '@phoenix/contracts'
import type { GalnetAnalysisRepository } from '../domain/galnet-analysis.js'

export class SqliteGalnetAnalysisRepository implements GalnetAnalysisRepository {
  public constructor (private readonly connection: DatabaseSync) {}

  public initialize (): void {
    this.connection.exec(`
      CREATE TABLE IF NOT EXISTS galnet_analyses (
        cache_key TEXT PRIMARY KEY,
        article_id TEXT NOT NULL,
        analysed_at TEXT NOT NULL,
        document TEXT NOT NULL
      ) STRICT;
      CREATE INDEX IF NOT EXISTS galnet_analyses_article ON galnet_analyses(article_id, analysed_at DESC);
      INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES (27, datetime('now'));
    `)
    if (!this.connection.prepare('SELECT 1 FROM schema_migrations WHERE version = 29').get()) {
      this.connection.exec('BEGIN IMMEDIATE')
      try {
        this.connection.exec(`
        CREATE TABLE galnet_analysis_heads (article_id TEXT PRIMARY KEY, cache_key TEXT NOT NULL
          REFERENCES galnet_analyses(cache_key)) STRICT;
        INSERT INTO galnet_analysis_heads
          SELECT article_id, cache_key FROM (
            SELECT article_id, cache_key,
              ROW_NUMBER() OVER (PARTITION BY article_id ORDER BY analysed_at DESC, rowid DESC) AS rank
            FROM galnet_analyses
          ) WHERE rank = 1;
        INSERT INTO schema_migrations (version, applied_at) VALUES (29, datetime('now'));
        `)
        this.connection.exec('COMMIT')
      } catch (cause) {
        this.connection.exec('ROLLBACK')
        throw cause
      }
    }
  }

  public get (cacheKey: string): GalnetAnalysis | null {
    return parse(this.connection.prepare('SELECT document FROM galnet_analyses WHERE cache_key = ?').get(cacheKey))
  }

  public latest (articleId: string): GalnetAnalysis | null {
    return parse(this.connection.prepare(`SELECT a.document FROM galnet_analysis_heads h
      JOIN galnet_analyses a ON a.cache_key = h.cache_key WHERE h.article_id = ?`).get(articleId))
  }

  public put (analysis: GalnetAnalysis): void {
    const validated = GalnetAnalysisSchema.parse(analysis)
    this.connection.exec('BEGIN IMMEDIATE')
    try {
      this.connection.prepare(`INSERT INTO galnet_analyses(cache_key, article_id, analysed_at, document)
        VALUES (?, ?, ?, ?) ON CONFLICT(cache_key) DO NOTHING`)
        .run(validated.cacheKey, validated.articleId, validated.analysedAt, JSON.stringify(validated))
      this.connection.prepare(`INSERT INTO galnet_analysis_heads VALUES (?, ?)
        ON CONFLICT(article_id) DO UPDATE SET cache_key = excluded.cache_key`).run(validated.articleId, validated.cacheKey)
      this.connection.exec('COMMIT')
    } catch (cause) {
      this.connection.exec('ROLLBACK')
      throw cause
    }
  }

  public recent (limit: number): GalnetAnalysis[] {
    // Select the same current report as latest(), including a reused older cache entry.
    // Analysis timestamps still describe the actual inference, not cache selection time.
    return this.connection.prepare(`
      SELECT a.document FROM galnet_analysis_heads h JOIN galnet_analyses a ON a.cache_key = h.cache_key
      ORDER BY a.analysed_at DESC, a.rowid DESC LIMIT ?
    `).all(limit).map(row => parse(row)!)
  }
}

function parse (row: Record<string, unknown> | undefined): GalnetAnalysis | null {
  return row ? GalnetAnalysisSchema.parse(JSON.parse(String(row.document))) : null
}
