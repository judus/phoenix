import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { expect, test } from 'vitest'
import { SqliteEddnOutbox } from '../apps/server/src/infrastructure/sqlite-eddn-outbox.js'
import { EDDN_MAX_AGE_MS, EddnQueueCapacityError, type EddnMessage } from '../apps/server/src/domain/eddn.js'

test('outbox schema initialization rolls back on failure and can be retried on the same connection', () => {
  const connection = new DatabaseSync(':memory:')
  const outbox = new SqliteEddnOutbox(connection)
  try {
    connection.exec('CREATE TABLE eddn_outbox (unexpected TEXT) STRICT')
    expect(() => outbox.initialize()).toThrow('no such column')
    expect(connection.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all())
      .toEqual([{ name: 'eddn_outbox' }])
    connection.exec('DROP TABLE eddn_outbox')
    outbox.initialize()
    outbox.initialize()
    expect(outbox.status()).toEqual({ queued: 0, lastSuccessAt: null, losses: [] })
  } finally { connection.close() }
})

test('pending data, retry reservations, receipts and acknowledgement survive database reopen', () => {
  const directory = mkdtempSync(join(tmpdir(), 'phoenix-eddn-db-'))
  const path = join(directory, 'outbox.sqlite')
  const now = Date.parse('2026-10-04T18:00:00Z')
  const message: EddnMessage = { $schemaRef: 'https://eddn.edcd.io/schemas/journal/1/test',
    header: { softwareName: 'PHOENIX', softwareVersion: '0.1.2', uploaderID: 'Test', gameversion: '4.0', gamebuild: 'r1' },
    message: { timestamp: new Date(now).toISOString(), event: 'Location', StarSystem: 'Sol', SystemAddress: 123, StarPos: [0, 0, 0] } }
  let connection = new DatabaseSync(path)
  try {
    let outbox = new SqliteEddnOutbox(connection)
    outbox.initialize()
    expect(outbox.enqueue('one', message, now)).toBe(true)
    outbox.beginAttempt('one', now + 75_000, now)
    connection.close()
    connection = new DatabaseSync(path)
    outbox = new SqliteEddnOutbox(connection)
    outbox.initialize()
    expect(outbox.next(now)).toBeUndefined()
    const interrupted = outbox.submissions(now)[0]
    expect(interrupted).toMatchObject({ outcome: 'interrupted', completedAt: null, httpStatus: null })
    expect(outbox.submission(interrupted.id, now)?.payload).toEqual(message)
    expect(outbox.next(now + 75_000)).toMatchObject({ id: 'one', attempts: 1, message })
    outbox.acknowledge('one', now + 75_000)
    connection.close()
    connection = new DatabaseSync(path)
    outbox = new SqliteEddnOutbox(connection)
    outbox.initialize()
    expect(outbox.status()).toEqual({ queued: 0, lastSuccessAt: new Date(now + 75_000).toISOString(), losses: [] })
    expect(outbox.enqueue('one', message, now + 80_000)).toBe(false)
    outbox.enqueue('two', message, now)
    outbox.prune(now + EDDN_MAX_AGE_MS)
    expect(outbox.status().queued).toBe(0)
    expect((connection.prepare('SELECT COUNT(*) AS count FROM eddn_receipts').get() as { count: number }).count).toBe(0)
  } finally { connection.close(); rmSync(directory, { recursive: true, force: true }) }
})

test('attempt history is newest-first, bounded, independent of pending uploads and expires', () => {
  const connection = new DatabaseSync(':memory:')
  const outbox = new SqliteEddnOutbox(connection)
  const now = Date.parse('2026-10-04T18:00:00Z')
  const message: EddnMessage = { $schemaRef: 'https://eddn.edcd.io/schemas/commodity/3/test',
    header: { softwareName: 'PHOENIX', softwareVersion: '0.1.2', uploaderID: 'Test', gameversion: '4.0', gamebuild: 'r1' },
    message: { systemName: 'Sol', stationName: 'Galileo', timestamp: new Date(now).toISOString(), commodities: [] } }
  try {
    outbox.initialize()
    outbox.enqueue('stock', message, now)
    let latest = 0
    for (let index = 0; index < 105; index++) {
      latest = outbox.beginAttempt('stock', now + 75_000, now)
      outbox.finishAttempt(latest, 'retry', 503, now, now + 60_000)
    }
    outbox.clear(now)
    const entries = outbox.submissions(now)
    expect(entries).toHaveLength(100)
    expect(entries[0]).toMatchObject({ id: latest, attempt: 105, system: 'Sol', station: 'Galileo', event: null })
    expect(outbox.submission(1, now)).toBeUndefined()
    expect(outbox.submission(latest, now)?.payload).toEqual(message)
    expect(outbox.submissions(now + 7 * EDDN_MAX_AGE_MS)).toEqual([])
    expect(outbox.submission(latest, now + 7 * EDDN_MAX_AGE_MS)).toBeUndefined()
  } finally { connection.close() }
})

test('history byte budget retains the newest attempts and summaries support dedicated system fields', () => {
  const connection = new DatabaseSync(':memory:')
  const outbox = new SqliteEddnOutbox(connection)
  const now = Date.parse('2026-10-04T18:00:00Z')
  const message: EddnMessage = { $schemaRef: 'https://eddn.edcd.io/schemas/codexentry/1/test',
    header: { softwareName: 'PHOENIX', softwareVersion: '0.1.3', uploaderID: 'Synthetic', gameversion: '4.0', gamebuild: '' },
    message: { event: 'CodexEntry', System: 'Sol', timestamp: new Date(now).toISOString(), Name: 'a'.repeat(1024 * 1024) } }
  try {
    outbox.initialize()
    outbox.enqueue('codex', message, now)
    for (let i = 0; i < 20; i++) outbox.beginAttempt('codex', now + 60_000, now)
    expect(outbox.submissions(now)).toHaveLength(15)
    expect(outbox.submissions(now)[0]).toMatchObject({ system: 'Sol', attempt: 20 })
    expect(outbox.submission(5, now)).toBeUndefined()
    expect(outbox.submission(20, now)?.payload).toEqual(message)
    const bytes = connection.prepare('SELECT SUM(length(CAST(document AS BLOB))) AS bytes FROM eddn_submissions').get() as { bytes: number }
    expect(bytes.bytes).toBeLessThanOrEqual(16 * 1024 * 1024)
  } finally { connection.close() }
})

test('loss totals survive database reopen, success and history expiry without counting empty clears twice', () => {
  const directory = mkdtempSync(join(tmpdir(), 'phoenix-eddn-losses-'))
  const path = join(directory, 'outbox.sqlite')
  const now = Date.parse('2026-10-04T18:00:00Z')
  let connection = new DatabaseSync(path)
  const message = lossFixture(now)
  try {
    let outbox = new SqliteEddnOutbox(connection)
    outbox.initialize()
    outbox.enqueue('expires', message, now)
    outbox.enqueue('accepted', message, now)
    const attempt = outbox.beginAttempt('accepted', now, now)
    outbox.finishAttempt(attempt, 'accepted', 200, now)
    outbox.acknowledge('accepted', now)
    outbox.prune(now + EDDN_MAX_AGE_MS - 1)
    expect(outbox.status().losses).toEqual([])
    outbox.prune(now + EDDN_MAX_AGE_MS)
    outbox.prune(now + EDDN_MAX_AGE_MS)
    outbox.enqueue('cleared', message, now + EDDN_MAX_AGE_MS)
    outbox.clear(now + EDDN_MAX_AGE_MS)
    outbox.clear(now + EDDN_MAX_AGE_MS)
    outbox.drop('missing', 'invalid', now)
    connection.close()
    connection = new DatabaseSync(path)
    outbox = new SqliteEddnOutbox(connection)
    outbox.initialize()
    outbox.prune(now + 8 * EDDN_MAX_AGE_MS)
    expect(outbox.submissions(now + 8 * EDDN_MAX_AGE_MS)).toEqual([])
    expect(outbox.status()).toEqual({ queued: 0, lastSuccessAt: new Date(now).toISOString(), losses: [
      { reason: 'cleared', count: 1, lastAt: new Date(now + EDDN_MAX_AGE_MS).toISOString() },
      { reason: 'expired', count: 1, lastAt: new Date(now + EDDN_MAX_AGE_MS).toISOString() }
    ] })
  } finally { connection.close(); rmSync(directory, { recursive: true, force: true }) }
})

test.each(['drop', 'clear', 'prune'] as const)('%s rolls queue removal back if durable loss accounting fails', operation => {
  const connection = new DatabaseSync(':memory:')
  const outbox = new SqliteEddnOutbox(connection)
  const now = Date.parse('2026-10-04T18:00:00Z')
  try {
    connection.exec('PRAGMA foreign_keys = ON')
    outbox.initialize()
    outbox.enqueue('one', lossFixture(now), now)
    connection.exec(`CREATE TRIGGER fail_loss BEFORE INSERT ON eddn_losses BEGIN SELECT RAISE(ABORT, 'Synthetic loss write failure'); END`)
    const remove = () => operation === 'drop' ? outbox.drop('one', 'invalid', now)
      : operation === 'clear' ? outbox.clear(now) : outbox.prune(now + EDDN_MAX_AGE_MS)
    expect(remove).toThrow('Synthetic loss write failure')
    expect(outbox.status()).toMatchObject({ queued: 1, losses: [] })
    expect(outbox.next(now)?.id).toBe('one')
    expect(connection.prepare('SELECT id FROM eddn_receipts').get()).toEqual({ id: 'one' })
    connection.exec('DROP TRIGGER fail_loss')
    remove()
    remove()
    expect(outbox.status()).toMatchObject({ queued: 0, losses: [{
      reason: operation === 'drop' ? 'invalid' : operation === 'clear' ? 'cleared' : 'expired', count: 1
    }] })
  } finally { connection.close() }
})

function lossFixture(now: number): EddnMessage {
  return { $schemaRef: 'https://eddn.edcd.io/schemas/journal/1/test',
    header: { softwareName: 'PHOENIX', softwareVersion: '0.1.5', uploaderID: 'Synthetic', gameversion: '4.0', gamebuild: '' },
    message: { timestamp: new Date(now).toISOString(), event: 'Location', StarSystem: 'Sol' } }
}

test('failed first-checkpoint counts aggregate without receipts and retry once without moving latest loss time backwards', () => {
  const connection = new DatabaseSync(':memory:')
  try {
    const outbox = new SqliteEddnOutbox(connection)
    outbox.initialize()
    connection.prepare(`WITH RECURSIVE ids(id) AS (SELECT 1 UNION ALL SELECT id + 1 FROM ids WHERE id < 100000)
      INSERT INTO eddn_receipts(id, created_at) SELECT CAST(id AS TEXT), 1000 FROM ids`).run()
    connection.exec(`CREATE TRIGGER fail_loss BEFORE INSERT ON eddn_losses BEGIN SELECT RAISE(ABORT, 'Synthetic loss write failure'); END`)
    for (let i = 0; i < 20; i++) expect(() => outbox.checkpointSignals(`signals:${i}`, null, i === 0 ? 4000 : 2000 + i)).toThrow(EddnQueueCapacityError)
    expect(() => outbox.retryCapacityLosses()).toThrow('Synthetic loss write failure')
    expect(outbox.status().losses).toEqual([])
    connection.exec('DROP TRIGGER fail_loss')
    expect(() => outbox.checkpointSignals('signals:later', null, 3000)).toThrow(EddnQueueCapacityError)
    outbox.retryCapacityLosses()
    outbox.retryCapacityLosses()
    expect(outbox.status()).toMatchObject({ queued: 0, losses: [{ reason: 'capacity', count: 21, lastAt: new Date(4000).toISOString() }] })
    expect(connection.prepare('SELECT COUNT(*) AS count FROM eddn_receipts').get()).toEqual({ count: 100000 })
    // Receipt-only duplicates are suppressed before admission; they are not capacity refusals.
    expect(outbox.checkpointSignals('1', null, 4000)).toBe(false)
    outbox.retryCapacityLosses()
    expect(outbox.status().losses[0].count).toBe(21)
  } finally { connection.close() }
})

test('retained pre-checkpoint queues migrate without changing payloads or retry leases', () => {
  const connection = new DatabaseSync(':memory:')
  try {
    connection.exec(`CREATE TABLE eddn_receipts(id TEXT PRIMARY KEY, created_at INTEGER NOT NULL) STRICT;
      CREATE TABLE eddn_outbox(id TEXT PRIMARY KEY REFERENCES eddn_receipts(id) ON DELETE CASCADE,
        document TEXT NOT NULL, created_at INTEGER NOT NULL, next_attempt INTEGER NOT NULL, attempts INTEGER NOT NULL DEFAULT 0) STRICT;`)
    const message = lossFixture(1000)
    connection.prepare('INSERT INTO eddn_receipts VALUES (?, ?)').run('retained', 1000)
    connection.prepare('INSERT INTO eddn_outbox VALUES (?, ?, ?, ?, ?)').run('retained', JSON.stringify(message), 1000, 76_000, 2)
    const outbox = new SqliteEddnOutbox(connection)
    outbox.initialize()
    outbox.initialize()
    expect(outbox.next(1000)).toBeUndefined()
    expect(outbox.next(76_000)).toEqual({ id: 'retained', attempts: 2, message })
    expect(outbox.checkpointSignals('retained', null, 1000)).toBe(false)
    expect(outbox.next(76_000)?.message).toEqual(message)
  } finally { connection.close() }
})

test('draft updates share queue budgets; capacity rejection removes the whole draft atomically', () => {
  const connection = new DatabaseSync(':memory:')
  try {
    const outbox = new SqliteEddnOutbox(connection)
    outbox.initialize()
    const message = lossFixture(1000)
    outbox.checkpointSignals('signals:first', message, 1000)
    for (let index = 1; index < 1000; index++) outbox.enqueue(String(index), message, 1000)
    expect(outbox.checkpointSignals('signals:first', { ...message, message: { ...message.message, extra: 'updated' } }, 1000)).toBe(true)
    expect(() => outbox.checkpointSignals('signals:rejected', message, 1000)).toThrow('at capacity')
    expect(outbox.status()).toMatchObject({ queued: 1000, losses: [{ reason: 'capacity', count: 1 }] })
    connection.exec(`CREATE TRIGGER fail_capacity BEFORE INSERT ON eddn_losses BEGIN SELECT RAISE(ABORT, 'Synthetic accounting failure'); END`)
    const huge = { ...message, message: { text: 's'.repeat(16 * 1024 * 1024) } }
    expect(() => outbox.checkpointSignals('signals:first', huge, 1000)).toThrow(EddnQueueCapacityError)
    expect(connection.prepare('SELECT id FROM eddn_outbox WHERE ready = 0').get()).toEqual({ id: 'signals:first' })
    expect(connection.prepare('SELECT COUNT(*) AS count FROM eddn_signal_checkpoints').get()).toEqual({ count: 2 })
    connection.exec('DROP TRIGGER fail_capacity')
    expect(() => outbox.checkpointSignals('signals:first', huge, 1000)).toThrow('at capacity')
    expect(connection.prepare('SELECT id FROM eddn_outbox WHERE ready = 0').get()).toBeUndefined()
    expect(connection.prepare('SELECT COUNT(*) AS count FROM eddn_signal_checkpoints').get()).toEqual({ count: 0 })
    expect(outbox.status()).toMatchObject({ queued: 999, losses: [{ reason: 'capacity', count: 2 }] })
    expect(outbox.checkpointSignals('signals:first', message, 1000)).toBe(false)
  } finally { connection.close() }
})

test('sealing rolls back both parent replacement and checkpoint deletion if cleanup fails', () => {
  const connection = new DatabaseSync(':memory:')
  try {
    const outbox = new SqliteEddnOutbox(connection)
    outbox.initialize()
    const message = lossFixture(1000)
    outbox.checkpointSignals('signals:first', message, 1000)
    connection.exec(`CREATE TRIGGER fail_seal BEFORE DELETE ON eddn_signal_checkpoints BEGIN SELECT RAISE(ABORT, 'Synthetic seal failure'); END`)
    expect(() => outbox.sealSignals('signals:first', message, 1000)).toThrow('Synthetic seal failure')
    expect(outbox.next(1000)).toBeUndefined()
    expect(connection.prepare('SELECT signal_bytes AS bytes FROM eddn_outbox').get()).toEqual({ bytes: Buffer.byteLength(JSON.stringify(message)) })
    expect(connection.prepare('SELECT COUNT(*) AS count FROM eddn_signal_checkpoints').get()).toEqual({ count: 1 })
    connection.exec('DROP TRIGGER fail_seal')
    outbox.sealSignals('signals:first', message, 1000)
    expect(outbox.next(1000)?.message).toEqual(message)
    expect(connection.prepare('SELECT COUNT(*) AS count FROM eddn_signal_checkpoints').get()).toEqual({ count: 0 })
    outbox.discardSignals('signals:first', 'invalid', 1000)
    expect(outbox.next(1000)?.message).toEqual(message)
    expect(outbox.status().losses).toEqual([])
  } finally { connection.close() }
})

test('the shared byte budget rejects new messages without evicting admitted work', () => {
  const connection = new DatabaseSync(':memory:')
  const now = Date.parse('2026-10-07T00:00:00Z')
  try {
    const outbox = new SqliteEddnOutbox(connection)
    outbox.initialize()
    const message = lossFixture(now)
    message.message.padding = ''
    message.message.padding = 'x'.repeat(2 * 1024 * 1024 - Buffer.byteLength(JSON.stringify(message)))
    for (let index = 0; index < 8; index++) expect(outbox.enqueue(String(index), message, now)).toBe(true)
    expect(() => outbox.enqueue('rejected', lossFixture(now), now)).toThrow(EddnQueueCapacityError)
    expect(outbox.status()).toMatchObject({ queued: 8, losses: [{ reason: 'capacity', count: 1 }] })
    expect(connection.prepare('SELECT id FROM eddn_receipts WHERE id = ?').get('rejected')).toBeUndefined()
    expect(outbox.next(now)).toMatchObject({ id: '0', message })
    outbox.acknowledge('0', now)
    expect(outbox.enqueue('rejected', lossFixture(now), now)).toBe(true)
  } finally { connection.close() }
})

test('acknowledged receipts can fill their own budget; age pruning permits fresh admissions', () => {
  const connection = new DatabaseSync(':memory:')
  const now = Date.parse('2026-10-07T00:00:00Z')
  try {
    const outbox = new SqliteEddnOutbox(connection)
    outbox.initialize()
    // Seed receipt-only history, not 100,000 uploads or outbox entries.
    connection.prepare(`WITH RECURSIVE ids(id) AS (SELECT 1 UNION ALL SELECT id + 1 FROM ids WHERE id < 100000)
      INSERT INTO eddn_receipts(id, created_at) SELECT CAST(id AS TEXT), ? FROM ids`).run(now)
    expect(() => outbox.enqueue('fresh', lossFixture(now), now)).toThrow(EddnQueueCapacityError)
    expect(outbox.status()).toMatchObject({ queued: 0, losses: [{ reason: 'capacity', count: 1 }] })
    outbox.prune(now + EDDN_MAX_AGE_MS - 1)
    expect(connection.prepare('SELECT COUNT(*) AS count FROM eddn_receipts').get()).toEqual({ count: 100000 })
    outbox.prune(now + EDDN_MAX_AGE_MS)
    expect(connection.prepare('SELECT COUNT(*) AS count FROM eddn_receipts').get()).toEqual({ count: 0 })
    expect(outbox.enqueue('fresh', lossFixture(now + EDDN_MAX_AGE_MS), now + EDDN_MAX_AGE_MS)).toBe(true)
    expect(outbox.status()).toMatchObject({ queued: 1, losses: [{ reason: 'capacity', count: 1 }] })
  } finally { connection.close() }
})
