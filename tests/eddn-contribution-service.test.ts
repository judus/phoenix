import { DatabaseSync } from 'node:sqlite'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { EddnContributionService } from '../apps/server/src/application/eddn-contribution-service.js'
import { SqliteEddnOutbox } from '../apps/server/src/infrastructure/sqlite-eddn-outbox.js'
import { EddnSchemaValidator } from '../apps/server/src/infrastructure/eddn-schema-validator.js'
import { InMemorySystemSettingsRepository } from '../apps/server/src/infrastructure/json-system-configuration.js'
import type { EddnMode } from '../apps/server/src/domain/eddn.js'

const cleanup: Array<() => Promise<void>> = []
afterEach(async () => { for (const dispose of cleanup.splice(0)) await dispose() })
const startTime = Date.parse('2026-10-04T18:00:00Z')
function fixture (mode: EddnMode = 'test') {
  let now = startTime
  const connection = new DatabaseSync(':memory:')
  const outbox = new SqliteEddnOutbox(connection)
  const settings = new InMemorySystemSettingsRepository()
  const send = vi.fn().mockResolvedValue({ status: 200 })
  const validator = new EddnSchemaValidator('resources/eddn')
  const options = { mode, outbox, settings, transport: { send }, version: '0.1.2',
    valid: (message: Parameters<typeof validator.valid>[0]) => validator.valid(message),
    readSnapshot: () => undefined, now: () => now }
  const service = new EddnContributionService(options)
  service.start()
  const event = { event: 'FSDJump', timestamp: new Date(now).toISOString(), StarSystem: 'Sol', SystemAddress: 10477373803, StarPos: [0, 0, 0] }
  service.observe({ event: 'Fileheader', timestamp: event.timestamp, gameversion: '4.0', build: 'r1' }, { id: 'header', replayed: true })
  service.observe({ event: 'LoadGame', timestamp: event.timestamp, Commander: 'Test', Horizons: true }, { id: 'load', replayed: true })
  cleanup.push(async () => { await service.stop(); connection.close() })
  return { service, outbox, connection, settings, send, event, options, advance: (ms: number) => { now += ms } }
}

describe('EDDN contribution lifecycle', () => {
  test('default preference is on but a gated build never queues or sends', async () => {
    const f = fixture('unavailable')
    f.service.observe(f.event, { id: 'jump', replayed: false })
    await f.service.flush()
    expect(f.service.status()).toMatchObject({ enabled: true, mode: 'unavailable', queued: 0 })
    expect(f.send).not.toHaveBeenCalled()
  })

  test('excludes bootstrap, deduplicates fresh events and records acknowledgement', async () => {
    const f = fixture()
    f.service.observe(f.event, { id: 'bootstrap', replayed: true })
    expect(f.outbox.status().queued).toBe(0)
    f.service.observe(f.event, { id: 'jump', replayed: false })
    f.service.observe(f.event, { id: 'jump', replayed: false })
    expect(f.outbox.status().queued).toBe(1)
    await f.service.flush()
    f.service.observe(f.event, { id: 'jump', replayed: false })
    expect(f.outbox.status()).toEqual({ queued: 0, lastSuccessAt: new Date(startTime).toISOString(), losses: [] })
    expect(f.send).toHaveBeenCalledOnce()
    const log = f.service.submissionLog()
    expect(log.entries).toHaveLength(1)
    expect(log.entries[0]).toMatchObject({ event: 'FSDJump', system: 'Sol', attempt: 1, outcome: 'accepted', httpStatus: 200 })
    expect(f.service.submission(log.entries[0].id)?.payload).toEqual(f.send.mock.calls[0][0])
  })

  test('queue and receipts survive service restart', async () => {
    const f = fixture()
    f.service.observe(f.event, { id: 'jump', replayed: false })
    await f.service.stop()
    const restarted = new EddnContributionService(f.options)
    restarted.start()
    try {
      expect(restarted.status().queued).toBe(1)
      await restarted.flush()
      expect(f.outbox.status().queued).toBe(0)
      expect(f.send).toHaveBeenCalledOnce()
      expect(f.outbox.enqueue('jump', f.send.mock.calls[0][0], startTime)).toBe(false)
    } finally { await restarted.stop() }
  })

  test.each([0, 408, 429, 500, 503])('retries transient status %i only after at least a minute', async status => {
    const f = fixture()
    f.send.mockResolvedValue({ status })
    f.service.observe(f.event, { id: 'jump', replayed: false })
    await f.service.flush()
    f.advance(59_999)
    await f.service.flush()
    expect(f.send).toHaveBeenCalledOnce()
    f.advance(1)
    await f.service.flush()
    expect(f.send).toHaveBeenCalledTimes(2)
    f.advance(60_000)
    await f.service.flush()
    expect(f.send).toHaveBeenCalledTimes(2)
    expect(f.service.submissionLog().entries).toMatchObject([
      { attempt: 2, outcome: 'retry', httpStatus: status || null, retryAt: new Date(startTime + 180_000).toISOString() },
      { attempt: 1, outcome: 'retry', httpStatus: status || null }
    ])
  })

  test.each([400, 401, 403, 413, 426])('discards permanent status %i without blocking following messages', async status => {
    const f = fixture()
    f.send.mockResolvedValueOnce({ status })
    f.service.observe(f.event, { id: 'one', replayed: false })
    f.service.observe(f.event, { id: 'two', replayed: false })
    await f.service.flush()
    await f.service.flush()
    expect(f.outbox.status().queued).toBe(0)
    expect(f.send).toHaveBeenCalledTimes(2)
    expect(f.service.submissionLog().entries).toMatchObject([
      { outcome: 'accepted', httpStatus: 200 }, { outcome: 'rejected', httpStatus: status }
    ])
    expect(f.service.status()).toMatchObject({ error: null, losses: [
      { reason: 'rejected', count: 1, lastAt: new Date(startTime).toISOString() }
    ] })
  })

  test('disable cancels in-flight work, clears queue, and late completion cannot undo opt-out', async () => {
    const f = fixture()
    let complete!: (value: { status: number }) => void
    f.send.mockImplementation(() => new Promise(resolve => { complete = resolve }))
    f.service.observe(f.event, { id: 'one', replayed: false })
    const pending = f.service.flush()
    const signal = f.send.mock.calls[0][1] as AbortSignal
    f.advance(1000)
    f.service.setEnabled(false)
    expect(signal.aborted).toBe(true)
    expect(f.outbox.status().queued).toBe(0)
    f.service.setEnabled(true)
    complete({ status: 200 })
    await pending
    expect(f.outbox.status().lastSuccessAt).toBeNull()
    expect(f.service.submissionLog().entries[0]).toMatchObject({ outcome: 'interrupted', httpStatus: 200 })
    f.service.observe(f.event, { id: 'old', replayed: false })
    expect(f.outbox.status().queued).toBe(0)
    f.service.observe({ ...f.event, timestamp: new Date(startTime + 1000).toISOString() }, { id: 'new', replayed: false })
    expect(f.outbox.status().queued).toBe(1)
  })

  test('storage failures do not propagate into journal projection; queue capacity is bounded', async () => {
    const f = fixture()
    vi.spyOn(f.outbox, 'enqueue').mockImplementationOnce(() => { throw new Error('private path') })
    expect(() => f.service.observe(f.event, { id: 'failure', replayed: false })).not.toThrow()
    expect(f.service.status().error).not.toContain('private path')
    for (let index = 0; index <= 1000; index++) f.service.observe(f.event, { id: String(index), replayed: false })
    expect(f.outbox.status().queued).toBe(1000)
    expect(f.service.status()).toMatchObject({ losses: [{ reason: 'capacity', count: 1 }] })
    expect((f.connection.prepare('SELECT COUNT(*) AS count FROM eddn_receipts').get() as { count: number }).count).toBe(1000)
    expect(f.service.status().error).toContain('queue is full')
    await f.service.flush()
    f.service.observe(f.event, { id: '1000', replayed: false })
    expect(f.service.status()).toMatchObject({ queued: 1000, error: null, losses: [{ reason: 'capacity', count: 1 }] })
  })

  test('expired and future observations are excluded, expired queue entries are pruned', async () => {
    const f = fixture()
    f.service.observe({ ...f.event, timestamp: '2026-10-02T00:00:00Z' }, { id: 'old', replayed: false })
    f.service.observe({ ...f.event, timestamp: '2026-10-06T00:00:00Z' }, { id: 'future', replayed: false })
    expect(f.outbox.status().queued).toBe(0)
    f.service.observe(f.event, { id: 'new', replayed: false })
    f.advance(24 * 60 * 60_000)
    await f.service.flush()
    expect(f.outbox.status().queued).toBe(0)
    expect(f.send).not.toHaveBeenCalled()
    expect(f.service.status()).toMatchObject({ losses: [{ reason: 'expired', count: 1 }] })
  })

  test.each(['null', '{}', '{broken'])('a corrupt queued document (%s) cannot block later observations', async document => {
    const f = fixture()
    f.service.observe(f.event, { id: 'one', replayed: false })
    f.service.observe(f.event, { id: 'two', replayed: false })
    f.connection.prepare('UPDATE eddn_outbox SET document = ? WHERE id = ?').run(document, 'one')
    await f.service.flush()
    await f.service.flush()
    expect(f.outbox.status().queued).toBe(0)
    expect(f.send).toHaveBeenCalledOnce()
    expect(f.service.status()).toMatchObject({ error: null, losses: [{ reason: 'invalid', count: 1 }] })
  })

  test('shutdown aborts a send and preserves its durable retry deadline', async () => {
    const f = fixture()
    f.send.mockImplementation((_, signal: AbortSignal) => new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })
    }))
    f.service.observe(f.event, { id: 'one', replayed: false })
    const sending = f.service.flush()
    await f.service.stop()
    await sending
    expect(f.outbox.status().queued).toBe(1)
    expect(f.outbox.next(startTime)).toBeUndefined()
    expect(f.outbox.next(startTime + 75_000)).toMatchObject({ id: 'one', attempts: 1 })
    expect(f.service.submissionLog().entries[0]).toMatchObject({ outcome: 'interrupted', httpStatus: null })
  })

  test('offline expiry at restart remains visible after a fresh upload succeeds', async () => {
    const f = fixture()
    f.service.observe(f.event, { id: 'offline', replayed: false })
    await f.service.stop()
    f.advance(24 * 60 * 60_000)
    const restarted = new EddnContributionService(f.options)
    restarted.start()
    try {
      expect(restarted.status()).toMatchObject({ queued: 0, losses: [{ reason: 'expired', count: 1 }] })
      await restarted.flush()
      expect(f.send).not.toHaveBeenCalled()
      restarted.observe({ event: 'Fileheader', timestamp: f.event.timestamp, gameversion: '4.0', build: 'r1' }, { id: 'header', replayed: true })
      restarted.observe({ event: 'LoadGame', timestamp: f.event.timestamp, Commander: 'Test', Horizons: true }, { id: 'load', replayed: true })
      restarted.observe({ ...f.event, timestamp: new Date(startTime + 24 * 60 * 60_000).toISOString() }, { id: 'fresh', replayed: false })
      await restarted.flush()
      expect(f.send).toHaveBeenCalledOnce()
      expect(restarted.status()).toMatchObject({ queued: 0, error: null, losses: [{ reason: 'expired', count: 1 }] })
    } finally { await restarted.stop() }
  })
})
