import type { DatabaseSync } from 'node:sqlite'
import type { EddnSubmission, EddnSubmissionDetail } from '@phoenix/contracts'
import { EDDN_MAX_AGE_MS, type EddnMessage, type EddnOutbox, type EddnPendingMessage } from '../domain/eddn.js'

export class SqliteEddnOutbox implements EddnOutbox {
  public constructor (private readonly connection: DatabaseSync) {}

  public initialize (): void {
    this.connection.exec(`
      CREATE TABLE IF NOT EXISTS eddn_receipts (id TEXT PRIMARY KEY, created_at INTEGER NOT NULL) STRICT;
      CREATE INDEX IF NOT EXISTS eddn_receipts_age ON eddn_receipts(created_at);
      CREATE TABLE IF NOT EXISTS eddn_outbox (
        id TEXT PRIMARY KEY REFERENCES eddn_receipts(id) ON DELETE CASCADE,
        document TEXT NOT NULL, created_at INTEGER NOT NULL, next_attempt INTEGER NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0
      ) STRICT;
      CREATE INDEX IF NOT EXISTS eddn_outbox_due ON eddn_outbox(next_attempt);
      CREATE TABLE IF NOT EXISTS eddn_status (id INTEGER PRIMARY KEY CHECK(id = 1), last_success_at TEXT) STRICT;
      INSERT OR IGNORE INTO eddn_status(id) VALUES (1);
      CREATE TABLE IF NOT EXISTS eddn_submissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT, observation_id TEXT NOT NULL,
        document TEXT NOT NULL, started_at INTEGER NOT NULL, completed_at TEXT,
        attempt INTEGER NOT NULL, outcome TEXT NOT NULL, http_status INTEGER, retry_at TEXT
      ) STRICT;
      UPDATE eddn_submissions SET outcome = 'interrupted' WHERE outcome = 'sending';
    `)
  }

  public enqueue (id: string, message: EddnMessage, now: number): boolean {
    const document = JSON.stringify(message)
    this.connection.exec('BEGIN IMMEDIATE')
    try {
      if (this.connection.prepare('SELECT 1 FROM eddn_receipts WHERE id = ?').get(id)) {
        this.connection.exec('COMMIT')
        return false
      }
      const usage = this.connection.prepare('SELECT COUNT(*) AS count, COALESCE(SUM(length(CAST(document AS BLOB))), 0) AS bytes FROM eddn_outbox').get() as { count: number, bytes: number }
      const receipts = this.connection.prepare('SELECT COUNT(*) AS count FROM eddn_receipts').get() as { count: number }
      if (usage.count >= 1000 || usage.bytes + Buffer.byteLength(document) > 16 * 1024 * 1024 || receipts.count >= 100_000) {
        throw new Error('Contribution storage limit reached. Delivery will resume when space is available.')
      }
      this.connection.prepare('INSERT INTO eddn_receipts(id, created_at) VALUES (?, ?)').run(id, now)
      this.connection.prepare('INSERT INTO eddn_outbox(id, document, created_at, next_attempt) VALUES (?, ?, ?, ?)').run(id, document, now, now)
      this.connection.exec('COMMIT')
      return true
    } catch (cause) {
      this.connection.exec('ROLLBACK')
      throw cause
    }
  }

  public next (now: number): EddnPendingMessage | undefined {
    const row = this.connection.prepare('SELECT id, document, attempts FROM eddn_outbox WHERE next_attempt <= ? ORDER BY next_attempt, created_at, id LIMIT 1')
      .get(now) as { id: string, document: string, attempts: number } | undefined
    if (!row) return undefined
    try {
      return { id: row.id, attempts: row.attempts, message: JSON.parse(row.document) as unknown }
    } catch {
      this.discard(row.id)
      throw new Error('An unreadable queued observation was discarded.')
    }
  }

  public acknowledge (id: string, now: number): void {
    this.connection.exec('BEGIN IMMEDIATE')
    try {
      this.discard(id)
      this.connection.prepare('UPDATE eddn_status SET last_success_at = ? WHERE id = 1').run(new Date(now).toISOString())
      this.connection.exec('COMMIT')
    } catch (cause) {
      this.connection.exec('ROLLBACK')
      throw cause
    }
  }

  public discard (id: string): void { this.connection.prepare('DELETE FROM eddn_outbox WHERE id = ?').run(id) }
  public beginAttempt (id: string, nextAttempt: number, now: number): number {
    this.connection.exec('BEGIN IMMEDIATE')
    try {
      this.connection.prepare('UPDATE eddn_outbox SET attempts = attempts + 1, next_attempt = ? WHERE id = ?').run(nextAttempt, id)
      const result = this.connection.prepare(`INSERT INTO eddn_submissions(observation_id, document, started_at, attempt, outcome)
        SELECT id, document, ?, attempts, 'sending' FROM eddn_outbox WHERE id = ?`).run(now, id)
      if (result.changes !== 1) throw new Error('Queued observation is missing.')
      this.pruneSubmissions(now)
      this.connection.exec('COMMIT')
      return Number(result.lastInsertRowid)
    } catch (cause) {
      this.connection.exec('ROLLBACK')
      throw cause
    }
  }
  public finishAttempt (id: number, outcome: Exclude<EddnSubmission['outcome'], 'sending'>, httpStatus: number | null, now: number, retryAt?: number): void {
    this.connection.prepare('UPDATE eddn_submissions SET outcome = ?, http_status = ?, completed_at = ?, retry_at = ? WHERE id = ?')
      .run(outcome, httpStatus, new Date(now).toISOString(), retryAt === undefined ? null : new Date(retryAt).toISOString(), id)
  }
  public submissions (now: number): EddnSubmission[] {
    this.pruneSubmissions(now)
    // Return summaries only; potentially large stock payloads are fetched on selection.
    const rows = this.connection.prepare(`SELECT id, observation_id AS observationId, started_at AS startedAt,
      completed_at AS completedAt, attempt, outcome, http_status AS httpStatus, retry_at AS retryAt,
      json_extract(document, '$.$schemaRef') AS schemaRef,
      json_extract(document, '$.message.event') AS event,
      COALESCE(json_extract(document, '$.message.StarSystem'), json_extract(document, '$.message.systemName'),
        json_extract(document, '$.message.SystemName'), json_extract(document, '$.message.System')) AS system,
      COALESCE(json_extract(document, '$.message.StationName'), json_extract(document, '$.message.stationName'),
        json_extract(document, '$.message.CarrierName')) AS station
      FROM eddn_submissions ORDER BY id DESC`).all() as unknown as Array<Omit<EddnSubmission, 'startedAt'> & { startedAt: number }>
    return rows.map(row => ({ ...row, startedAt: new Date(row.startedAt).toISOString() }))
  }
  public submission (id: number, now: number): EddnSubmissionDetail | undefined {
    this.pruneSubmissions(now)
    const row = this.connection.prepare('SELECT document FROM eddn_submissions WHERE id = ?').get(id) as { document: string } | undefined
    return row ? { payload: JSON.parse(row.document) as Record<string, unknown> } : undefined
  }
  private pruneSubmissions (now: number): void {
    this.connection.prepare('DELETE FROM eddn_submissions WHERE started_at <= ?').run(now - 7 * EDDN_MAX_AGE_MS)
    this.connection.exec('DELETE FROM eddn_submissions WHERE id IN (SELECT id FROM eddn_submissions ORDER BY id DESC LIMIT -1 OFFSET 100)')
    // The inner window preserves the newest contiguous history within a byte budget.
    this.connection.exec(`DELETE FROM eddn_submissions WHERE id IN (
      SELECT id FROM (
        SELECT id, SUM(length(CAST(document AS BLOB))) OVER (ORDER BY id DESC) AS bytes FROM eddn_submissions
      ) WHERE bytes > 16777216
    )`)
  }
  public retry (id: string, nextAttempt: number): void {
    this.connection.prepare('UPDATE eddn_outbox SET next_attempt = ? WHERE id = ?').run(nextAttempt, id)
  }
  public clear (): void { this.connection.exec('DELETE FROM eddn_outbox') }
  public prune (now: number): void {
    this.pruneSubmissions(now)
    // Delete explicitly as well: callers/tests need not enable SQLite foreign keys.
    this.connection.prepare('DELETE FROM eddn_outbox WHERE created_at <= ?').run(now - EDDN_MAX_AGE_MS)
    this.connection.prepare('DELETE FROM eddn_receipts WHERE created_at <= ?').run(now - EDDN_MAX_AGE_MS)
  }
  public status (): { queued: number, lastSuccessAt: string | null } {
    const row = this.connection.prepare('SELECT (SELECT COUNT(*) FROM eddn_outbox) AS queued, last_success_at AS lastSuccessAt FROM eddn_status WHERE id = 1')
      .get() as { queued: number, lastSuccessAt: string | null }
    return row
  }
}
