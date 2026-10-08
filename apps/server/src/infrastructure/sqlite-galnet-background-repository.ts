import type { DatabaseSync } from 'node:sqlite'
import { GalnetBackgroundJobSchema, type GalnetBackgroundJob } from '@phoenix/contracts'
import type { GalnetBackgroundRepository, GalnetBackgroundState } from '../domain/galnet-background.js'

/** Durable work, deliberately separate from the replaceable provider-response cache. */
export class SqliteGalnetBackgroundRepository implements GalnetBackgroundRepository {
  public constructor(private readonly db: DatabaseSync) {}

  public initialize(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS galnet_background_state (id INTEGER PRIMARY KEY CHECK(id = 1), document TEXT NOT NULL) STRICT;
      CREATE TABLE IF NOT EXISTS galnet_background_observations (article_id TEXT PRIMARY KEY, revision_id TEXT NOT NULL) STRICT;
      CREATE TABLE IF NOT EXISTS galnet_background_jobs (
        id TEXT PRIMARY KEY, article_id TEXT NOT NULL, state TEXT NOT NULL,
        started_at TEXT, document TEXT NOT NULL
      ) STRICT;
      INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES (28, datetime('now'));
    `)
    if (!this.db.prepare('SELECT id FROM galnet_background_state').get()) {
      this.save({ enabled: false, dailyLimit: 10, installedAt: new Date().toISOString(),
        lastCheckedAt: null, sourceError: null, goals: {} })
    }
    // A provider may have charged before a process died. Never blindly retry that request.
    for (const job of this.list('running')) this.put({ ...job, state: 'failed',
      finishedAt: new Date().toISOString(), error: 'PHOENIX stopped during analysis. Retry manually; API credit may have been used.' })
  }

  public load(): GalnetBackgroundState {
    const row = this.db.prepare('SELECT document FROM galnet_background_state WHERE id = 1').get() as { document: string }
    return JSON.parse(row.document) as GalnetBackgroundState
  }

  public save(state: GalnetBackgroundState): void {
    this.db.prepare('INSERT INTO galnet_background_state VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET document = excluded.document')
      .run(JSON.stringify(state))
  }

  public observed(articleId: string): string | null {
    const old = this.db.prepare('SELECT revision_id FROM galnet_background_observations WHERE article_id = ?').get(articleId) as { revision_id: string } | undefined
    return old?.revision_id ?? null
  }

  public observe(articleId: string, revisionId: string): string | null {
    const old = this.observed(articleId)
    this.db.prepare(`INSERT INTO galnet_background_observations VALUES (?, ?)
      ON CONFLICT(article_id) DO UPDATE SET revision_id = excluded.revision_id`).run(articleId, revisionId)
    return old
  }

  public enqueue(job: GalnetBackgroundJob): boolean {
    // Admission and its capacity check are one SQLite statement, for every producer.
    const inserted = this.db.prepare(`INSERT OR IGNORE INTO galnet_background_jobs
      SELECT ?, ?, ?, ?, ? WHERE (SELECT COUNT(*) FROM galnet_background_jobs WHERE state = 'pending') < 100`)
      .run(job.id, job.articleId, job.state, job.startedAt, JSON.stringify(job)).changes
    return inserted !== 0 || this.db.prepare('SELECT id FROM galnet_background_jobs WHERE id = ?').get(job.id) !== undefined
  }

  public put(job: GalnetBackgroundJob): void {
    this.db.prepare('UPDATE galnet_background_jobs SET state = ?, started_at = ?, document = ? WHERE id = ?')
      .run(job.state, job.startedAt, JSON.stringify(job), job.id)
  }

  public list(state?: GalnetBackgroundJob['state'], limit = 100): GalnetBackgroundJob[] {
    const rows = state
      ? this.db.prepare('SELECT document FROM galnet_background_jobs WHERE state = ? ORDER BY rowid ASC LIMIT ?').all(state, limit)
      : this.db.prepare(`SELECT document FROM galnet_background_jobs
          ORDER BY COALESCE(json_extract(document, '$.finishedAt'), started_at, json_extract(document, '$.queuedAt')) DESC, rowid DESC LIMIT ?`).all(limit)
    return rows.map(row => GalnetBackgroundJobSchema.parse(JSON.parse(String(row.document))))
  }

  public pending(): number {
    return Number(this.db.prepare("SELECT COUNT(*) AS count FROM galnet_background_jobs WHERE state = 'pending'").get()!.count)
  }

  public next(includeAutomatic: boolean, blockedArticleIds: string[] = []): GalnetBackgroundJob | null {
    // Publication order is the dependency order: story context only uses strictly earlier
    // articles. Admission order alone fails when an older correction arrives after a new job.
    const row = this.db.prepare(`SELECT j.document FROM galnet_background_jobs j
      LEFT JOIN galnet_article_revisions r ON r.article_id = j.article_id
        AND r.revision_id = json_extract(j.document, '$.articleRevisionId')
      WHERE j.state = 'pending' AND (? OR json_extract(j.document, '$.reason') = 'catch-up')
        AND j.article_id NOT IN (SELECT value FROM json_each(?))
      ORDER BY julianday(json_extract(r.document, '$.article.publishedAt')) ASC, j.rowid ASC LIMIT 1`)
      .get(Number(includeAutomatic), JSON.stringify(blockedArticleIds))
    return row ? GalnetBackgroundJobSchema.parse(JSON.parse(String(row.document))) : null
  }

  public activeArticleIds(): string[] {
    return this.db.prepare("SELECT DISTINCT article_id FROM galnet_background_jobs WHERE state IN ('pending', 'running')")
      .all().map(row => String(row.article_id))
  }

  public requestsSince(since: string): number {
    return Number(this.db.prepare('SELECT COUNT(*) AS count FROM galnet_background_jobs WHERE started_at >= ?').get(since)!.count)
  }
}
