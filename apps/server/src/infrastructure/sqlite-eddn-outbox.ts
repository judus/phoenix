import type { DatabaseSync } from 'node:sqlite'
import type { EddnLoss, EddnStatus, EddnSubmission, EddnSubmissionDetail } from '@phoenix/contracts'
import { EDDN_MAX_AGE_MS, EddnQueueCapacityError, type EddnMessage, type EddnOutbox, type EddnPendingMessage } from '../domain/eddn.js'

export class SqliteEddnOutbox implements EddnOutbox {
  // Refused first checkpoints have no durable draft to discard. Retain totals, never payloads/IDs.
  private pendingCapacityLosses?: { count: number, lastAt: number }

  public constructor (private readonly connection: DatabaseSync) {}

  public initialize (): void {
    // One durable schema commit, rather than one per table/index. Signal recovery below
    // owns separate transactions and must run after schema initialization commits.
    this.connection.exec('BEGIN IMMEDIATE')
    try {
      this.connection.exec(`
      CREATE TABLE IF NOT EXISTS eddn_receipts (id TEXT PRIMARY KEY, created_at INTEGER NOT NULL) STRICT;
      CREATE INDEX IF NOT EXISTS eddn_receipts_age ON eddn_receipts(created_at);
      CREATE TABLE IF NOT EXISTS eddn_outbox (
        id TEXT PRIMARY KEY REFERENCES eddn_receipts(id) ON DELETE CASCADE,
        document TEXT NOT NULL, created_at INTEGER NOT NULL, next_attempt INTEGER NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0, ready INTEGER NOT NULL DEFAULT 1 CHECK(ready IN (0, 1)),
        signal_bytes INTEGER NOT NULL DEFAULT 0
      ) STRICT;
      CREATE INDEX IF NOT EXISTS eddn_outbox_due ON eddn_outbox(next_attempt);
      CREATE TABLE IF NOT EXISTS eddn_signal_checkpoints (
        batch_id TEXT NOT NULL REFERENCES eddn_outbox(id) ON DELETE CASCADE, document TEXT NOT NULL
      ) STRICT;
      CREATE INDEX IF NOT EXISTS eddn_signal_batch ON eddn_signal_checkpoints(batch_id);
      CREATE TABLE IF NOT EXISTS eddn_status (id INTEGER PRIMARY KEY CHECK(id = 1), last_success_at TEXT) STRICT;
      INSERT OR IGNORE INTO eddn_status(id) VALUES (1);
      CREATE TABLE IF NOT EXISTS eddn_losses (
        reason TEXT PRIMARY KEY CHECK(reason IN ('expired', 'invalid', 'rejected', 'capacity', 'cleared')),
        count INTEGER NOT NULL CHECK(count > 0), last_at TEXT NOT NULL
      ) STRICT;
      CREATE TABLE IF NOT EXISTS eddn_submissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT, observation_id TEXT NOT NULL,
        document TEXT NOT NULL, started_at INTEGER NOT NULL, completed_at TEXT,
        attempt INTEGER NOT NULL, outcome TEXT NOT NULL, http_status INTEGER, retry_at TEXT
      ) STRICT;
      UPDATE eddn_submissions SET outcome = 'interrupted' WHERE outcome = 'sending';
      `)
      // Retained outboxes predate signal checkpoints; ordinary pending messages remain ready.
      const columns = this.connection.prepare('PRAGMA table_info(eddn_outbox)').all() as Array<{ name: string }>
      if (!columns.some(column => column.name === 'ready')) this.connection.exec('ALTER TABLE eddn_outbox ADD COLUMN ready INTEGER NOT NULL DEFAULT 1 CHECK(ready IN (0, 1))')
      if (!columns.some(column => column.name === 'signal_bytes')) this.connection.exec('ALTER TABLE eddn_outbox ADD COLUMN signal_bytes INTEGER NOT NULL DEFAULT 0')
      this.connection.exec('COMMIT')
    } catch (cause) {
      this.connection.exec('ROLLBACK')
      throw cause
    }
    // Rebuild each durable run once, not once per signal; null markers have no usable context.
    for (const row of this.connection.prepare('SELECT id FROM eddn_outbox WHERE ready = 0').all() as Array<{ id: string }>) {
      let message: EddnMessage | null = null
      try {
        const signals: unknown[] = []
        for (const part of this.connection.prepare('SELECT document FROM eddn_signal_checkpoints WHERE batch_id = ? ORDER BY rowid').all(row.id) as Array<{ document: string }>) {
          const envelope = JSON.parse(part.document) as EddnMessage
          if (!Array.isArray(envelope.message.signals)) throw new Error('Invalid signal checkpoint')
          message ??= envelope
          signals.push(...envelope.message.signals)
        }
        if (message) message.message.signals = signals
      } catch { message = null }
      this.sealSignals(row.id, message, Date.now())
    }
  }

  public enqueue (id: string, message: EddnMessage, now: number): boolean {
    return this.store(id, message, now, true)
  }

  public checkpointSignals (id: string, message: EddnMessage | null, now: number): boolean {
    return this.store(id, message, now, false)
  }

  public sealSignals (id: string, message: EddnMessage | null, now: number): void {
    const document = JSON.stringify(message)
    this.connection.exec('BEGIN IMMEDIATE')
    try {
      const previous = this.connection.prepare('SELECT signal_bytes + length(CAST(document AS BLOB)) AS bytes FROM eddn_outbox WHERE id = ? AND ready = 0').get(id) as { bytes: number } | undefined
      if (previous) {
        if (this.usage().bytes - previous.bytes + Buffer.byteLength(document) > 16 * 1024 * 1024) throw new EddnQueueCapacityError()
        this.connection.prepare('UPDATE eddn_outbox SET document = ?, ready = 1, signal_bytes = 0 WHERE id = ?').run(document, id)
        this.connection.prepare('DELETE FROM eddn_signal_checkpoints WHERE batch_id = ?').run(id)
      }
      this.connection.exec('COMMIT')
    } catch (cause) {
      this.connection.exec('ROLLBACK')
      if (cause instanceof EddnQueueCapacityError) {
        try { this.capacityFailure(id, now) } catch (cleanupCause) { throw new EddnQueueCapacityError({ cause: cleanupCause }) }
      }
      throw cause
    }
  }

  private usage (): { count: number, bytes: number } {
    return this.connection.prepare('SELECT COUNT(*) AS count, COALESCE(SUM(length(CAST(document AS BLOB)) + signal_bytes), 0) AS bytes FROM eddn_outbox').get() as { count: number, bytes: number }
  }

  private store (id: string, message: EddnMessage | null, now: number, ready: boolean): boolean {
    const document = JSON.stringify(message)
    let refusedFirstCheckpoint = false
    this.connection.exec('BEGIN IMMEDIATE')
    try {
      const previous = this.connection.prepare('SELECT ready FROM eddn_outbox WHERE id = ?').get(id) as { ready: number } | undefined
      if ((ready || previous?.ready !== 0) && this.connection.prepare('SELECT 1 FROM eddn_receipts WHERE id = ?').get(id)) {
        this.connection.exec('COMMIT')
        return false
      }
      const usage = this.usage()
      const receipts = this.connection.prepare('SELECT COUNT(*) AS count FROM eddn_receipts').get() as { count: number }
      const bytes = !ready && message === null ? 0 : Buffer.byteLength(document)
      if ((!previous && (usage.count >= 1000 || receipts.count >= 100_000)) || usage.bytes + bytes + (!previous && !ready ? 4 : 0) > 16 * 1024 * 1024) {
        refusedFirstCheckpoint = !ready && !previous
        throw new EddnQueueCapacityError()
      }
      if (!previous) {
        this.connection.prepare('INSERT INTO eddn_receipts(id, created_at) VALUES (?, ?)').run(id, now)
        this.connection.prepare('INSERT INTO eddn_outbox(id, document, created_at, next_attempt, ready) VALUES (?, ?, ?, ?, ?)').run(id, ready ? document : 'null', now, now, Number(ready))
      }
      if (!ready && message !== null) {
        this.connection.prepare('INSERT INTO eddn_signal_checkpoints(batch_id, document) VALUES (?, ?)').run(id, document)
        this.connection.prepare('UPDATE eddn_outbox SET signal_bytes = signal_bytes + ? WHERE id = ?').run(bytes, id)
      }
      this.connection.exec('COMMIT')
      return true
    } catch (cause) {
      this.connection.exec('ROLLBACK')
      if (cause instanceof EddnQueueCapacityError) {
        try { this.capacityFailure(ready ? undefined : id, now) } catch (cleanupCause) {
          if (refusedFirstCheckpoint) this.pendingCapacityLosses = {
            count: (this.pendingCapacityLosses?.count ?? 0) + 1,
            lastAt: Math.max(this.pendingCapacityLosses?.lastAt ?? now, now)
          }
          throw new EddnQueueCapacityError({ cause: cleanupCause })
        }
      }
      throw cause
    }
  }

  private capacityFailure (id: string | undefined, now: number): void {
    this.connection.exec('BEGIN IMMEDIATE')
    try {
      if (id) {
        this.connection.prepare('DELETE FROM eddn_signal_checkpoints WHERE batch_id IN (SELECT id FROM eddn_outbox WHERE id = ? AND ready = 0)').run(id)
        this.connection.prepare('DELETE FROM eddn_outbox WHERE id = ? AND ready = 0').run(id)
      }
      this.recordLoss('capacity', 1, now)
      this.connection.exec('COMMIT')
    } catch (cause) { this.connection.exec('ROLLBACK'); throw cause }
  }

  public retryCapacityLosses (): void {
    if (!this.pendingCapacityLosses) return
    this.recordLoss('capacity', this.pendingCapacityLosses.count, this.pendingCapacityLosses.lastAt)
    this.pendingCapacityLosses = undefined
  }

  public next (now: number): EddnPendingMessage | undefined {
    const row = this.connection.prepare('SELECT id, document, attempts FROM eddn_outbox WHERE ready = 1 AND next_attempt <= ? ORDER BY next_attempt, created_at, id LIMIT 1')
      .get(now) as { id: string, document: string, attempts: number } | undefined
    if (!row) return undefined
    try {
      return { id: row.id, attempts: row.attempts, message: JSON.parse(row.document) as unknown }
    } catch {
      this.drop(row.id, 'invalid', now)
      throw new Error('An unreadable queued observation was discarded.')
    }
  }

  public acknowledge (id: string, now: number): void {
    this.connection.exec('BEGIN IMMEDIATE')
    try {
      this.connection.prepare('DELETE FROM eddn_outbox WHERE id = ?').run(id)
      this.connection.prepare('UPDATE eddn_status SET last_success_at = ? WHERE id = 1').run(new Date(now).toISOString())
      this.connection.exec('COMMIT')
    } catch (cause) {
      this.connection.exec('ROLLBACK')
      throw cause
    }
  }

  public drop (id: string, reason: EddnLoss['reason'], now: number): void {
    this.remove(id, reason, now, false)
  }

  public discardSignals (id: string, reason: 'invalid' | 'cleared' | 'capacity', now: number): void {
    this.remove(id, reason, now, true)
  }

  private remove (id: string, reason: EddnLoss['reason'], now: number, draftOnly: boolean): void {
    this.connection.exec('BEGIN IMMEDIATE')
    try {
      const condition = draftOnly ? ' AND ready = 0' : ''
      this.connection.prepare(`DELETE FROM eddn_signal_checkpoints WHERE batch_id IN (SELECT id FROM eddn_outbox WHERE id = ?${condition})`).run(id)
      const deleted = this.connection.prepare(`DELETE FROM eddn_outbox WHERE id = ?${condition}`).run(id)
      this.recordLoss(reason, Number(deleted.changes), now)
      this.connection.exec('COMMIT')
    } catch (cause) {
      this.connection.exec('ROLLBACK')
      throw cause
    }
  }

  private recordLoss (reason: EddnLoss['reason'], count: number, now: number): void {
    if (count === 0) return
    this.connection.prepare(`INSERT INTO eddn_losses(reason, count, last_at) VALUES (?, ?, ?)
      ON CONFLICT(reason) DO UPDATE SET count = count + excluded.count, last_at = MAX(last_at, excluded.last_at)`)
      .run(reason, count, new Date(now).toISOString())
  }
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
  public clear (now: number): void {
    this.connection.exec('BEGIN IMMEDIATE')
    try {
      this.connection.exec('DELETE FROM eddn_signal_checkpoints')
      const deleted = this.connection.prepare('DELETE FROM eddn_outbox').run()
      this.recordLoss('cleared', Number(deleted.changes), now)
      this.connection.exec('COMMIT')
    } catch (cause) {
      this.connection.exec('ROLLBACK')
      throw cause
    }
  }
  public prune (now: number): void {
    this.pruneSubmissions(now)
    this.connection.exec('BEGIN IMMEDIATE')
    try {
      // Count pending losses before receipt cascades, even with SQLite foreign keys enabled.
      this.connection.prepare('DELETE FROM eddn_signal_checkpoints WHERE batch_id IN (SELECT id FROM eddn_outbox WHERE created_at <= ?)').run(now - EDDN_MAX_AGE_MS)
      const expired = this.connection.prepare('DELETE FROM eddn_outbox WHERE created_at <= ?').run(now - EDDN_MAX_AGE_MS)
      this.recordLoss('expired', Number(expired.changes), now)
      this.connection.prepare('DELETE FROM eddn_receipts WHERE created_at <= ?').run(now - EDDN_MAX_AGE_MS)
      this.connection.exec('COMMIT')
    } catch (cause) {
      this.connection.exec('ROLLBACK')
      throw cause
    }
  }
  public status (): Pick<EddnStatus, 'queued' | 'lastSuccessAt' | 'losses'> {
    const row = this.connection.prepare('SELECT (SELECT COUNT(*) FROM eddn_outbox) AS queued, last_success_at AS lastSuccessAt FROM eddn_status WHERE id = 1')
      .get() as { queued: number, lastSuccessAt: string | null }
    const losses = this.connection.prepare('SELECT reason, count, last_at AS lastAt FROM eddn_losses ORDER BY reason').all() as EddnLoss[]
    return { ...row, losses }
  }
}
