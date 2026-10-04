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
    expect(f.outbox.status()).toEqual({ queued: 0, lastSuccessAt: new Date(startTime).toISOString() })
    expect(f.send).toHaveBeenCalledOnce()
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
    f.service.observe(f.event, { id: 'old', replayed: false })
    expect(f.outbox.status().queued).toBe(0)
    f.service.observe({ ...f.event, timestamp: new Date(startTime + 1000).toISOString() }, { id: 'new', replayed: false })
    expect(f.outbox.status().queued).toBe(1)
  })

  test('storage failures do not propagate into journal projection; queue capacity is bounded', () => {
    const f = fixture()
    vi.spyOn(f.outbox, 'enqueue').mockImplementationOnce(() => { throw new Error('private path') })
    expect(() => f.service.observe(f.event, { id: 'failure', replayed: false })).not.toThrow()
    expect(f.service.status().error).not.toContain('private path')
    for (let index = 0; index <= 1000; index++) f.service.observe(f.event, { id: String(index), replayed: false })
    expect(f.outbox.status().queued).toBe(1000)
    expect((f.connection.prepare('SELECT COUNT(*) AS count FROM eddn_receipts').get() as { count: number }).count).toBe(1000)
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
  })
})
