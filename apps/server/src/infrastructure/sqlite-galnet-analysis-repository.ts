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
  }

  public get (cacheKey: string): GalnetAnalysis | null {
    return parse(this.connection.prepare('SELECT document FROM galnet_analyses WHERE cache_key = ?').get(cacheKey))
  }

  public latest (articleId: string): GalnetAnalysis | null {
    return parse(this.connection.prepare('SELECT document FROM galnet_analyses WHERE article_id = ? ORDER BY analysed_at DESC, rowid DESC LIMIT 1').get(articleId))
  }

  public put (analysis: GalnetAnalysis): void {
    const validated = GalnetAnalysisSchema.parse(analysis)
    this.connection.prepare(`INSERT INTO galnet_analyses(cache_key, article_id, analysed_at, document)
      VALUES (?, ?, ?, ?) ON CONFLICT(cache_key) DO NOTHING`)
      .run(validated.cacheKey, validated.articleId, validated.analysedAt, JSON.stringify(validated))
  }

  public recent (limit: number): GalnetAnalysis[] {
    // Rank before limiting: each article contributes only its latest saved report, with the
    // same timestamp/rowid tie-break as latest(). Older evidence/configuration variants remain saved.
    return this.connection.prepare(`
      SELECT document FROM (
        SELECT document, analysed_at, rowid,
          ROW_NUMBER() OVER (PARTITION BY article_id ORDER BY analysed_at DESC, rowid DESC) AS rank
        FROM galnet_analyses
      ) WHERE rank = 1 ORDER BY analysed_at DESC, rowid DESC LIMIT ?
    `).all(limit).map(row => parse(row)!)
  }
}

function parse (row: Record<string, unknown> | undefined): GalnetAnalysis | null {
  return row ? GalnetAnalysisSchema.parse(JSON.parse(String(row.document))) : null
}
