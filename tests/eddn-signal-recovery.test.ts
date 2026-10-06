import { appendFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, expect, test, vi } from 'vitest'
import { EliteJournalFileSource, type EliteJournalEvent } from '@phoenix/elite'
import { EddnContributionService } from '../apps/server/src/application/eddn-contribution-service.js'
import { EDDN_MAX_AGE_MS, EDDN_MAX_MESSAGE_BYTES } from '../apps/server/src/domain/eddn.js'
import { EddnMessageBuilder } from '../apps/server/src/domain/eddn-message-builder.js'
import { SqliteEddnOutbox } from '../apps/server/src/infrastructure/sqlite-eddn-outbox.js'
import { EddnSchemaValidator } from '../apps/server/src/infrastructure/eddn-schema-validator.js'
import { InMemorySystemSettingsRepository } from '../apps/server/src/infrastructure/json-system-configuration.js'

const timestamp = '2026-10-04T18:00:00Z'
const now = Date.parse(timestamp)
const header = { timestamp, event: 'Fileheader', gameversion: '4.0', build: 'r1' }
const load = { timestamp, event: 'LoadGame', Commander: 'Synthetic', Horizons: true, Odyssey: true }
const location = { timestamp, event: 'Location', StarSystem: 'Sol', SystemAddress: 123, StarPos: [0, 0, 0] }
const signal = { timestamp, event: 'FSSSignalDiscovered', SystemAddress: 123, SignalName: 'Public', SignalName_Localised: 'private', TimeRemaining: 60 }
const validator = new EddnSchemaValidator('resources/eddn')
const cleanup: Array<() => Promise<void>> = []
afterEach(async () => { for (const close of cleanup.splice(0).reverse()) await close() })

function fixture(path = ':memory:', settings = new InMemorySystemSettingsRepository(), time = now) {
  const connection = new DatabaseSync(path)
  const outbox = new SqliteEddnOutbox(connection)
  const send = vi.fn().mockResolvedValue({ status: 200 })
  const service = new EddnContributionService({ mode: 'test', version: '0.1.5', outbox, settings,
    transport: { send }, valid: message => validator.valid(message), readSnapshot: () => undefined, now: () => time })
  service.start()
  let closed = false
  cleanup.push(async () => { if (!closed) { await service.stop(); connection.close() } })
  const observe = (event: EliteJournalEvent, id: string, replayed = false) => service.observe(event, { id, replayed })
  for (const [index, event] of [header, load, location].entries()) observe(event, `bootstrap-${index}`, true)
  return { connection, outbox, service, send, settings, observe,
    crash: async () => {
      // Close storage first: stop cannot flush memory, just cancels the owned timer.
      connection.close(); closed = true; await service.stop()
    } }
}

function disk() {
  const directory = mkdtempSync(join(tmpdir(), 'phoenix-signals-'))
  cleanup.push(async () => rmSync(directory, { recursive: true, force: true }))
  return { directory, path: join(directory, 'outbox.sqlite') }
}

test('crash recovery sends only the last durable public envelope, without bootstrap duplication', async () => {
  const { path } = disk()
  const first = fixture(path)
  first.observe(signal, 'first')
  first.observe({ ...signal, SignalName: 'Second' }, 'second')
  expect(first.outbox.next(now)).toBeUndefined()
  expect(first.outbox.status().queued).toBe(1)
  await first.crash()
  const recovered = fixture(path, first.settings)
  recovered.observe(signal, 'first', true)
  recovered.observe({ ...signal, SignalName: 'Second' }, 'second', true)
  await recovered.service.flush()
  await recovered.service.flush()
  expect(recovered.send).toHaveBeenCalledOnce()
  expect(recovered.send.mock.calls[0][0].message).toMatchObject({ StarSystem: 'Sol', signals: [
    { timestamp, SignalName: 'Public' }, { timestamp, SignalName: 'Second' }
  ] })
  expect(JSON.stringify(recovered.send.mock.calls[0][0])).not.toMatch(/private|Localised|TimeRemaining/)
  recovered.observe(signal, 'first')
  recovered.observe({ timestamp, event: 'Music' }, 'close-duplicate')
  await recovered.service.flush()
  expect(recovered.send).toHaveBeenCalledOnce()
  expect(recovered.outbox.status()).toMatchObject({ queued: 0, losses: [] })
})

test('pre-arrival crash cannot borrow replayed or fresh location context', async () => {
  const { path } = disk()
  const first = fixture(path)
  first.observe({ timestamp, event: 'StartJump', JumpType: 'Hyperspace' }, 'start')
  first.observe(signal, 'unresolved')
  expect(first.connection.prepare('SELECT document FROM eddn_outbox').get()).toEqual({ document: 'null' })
  await first.crash()
  const recovered = fixture(path, first.settings)
  await recovered.service.flush()
  expect(recovered.send).not.toHaveBeenCalled()
  expect(recovered.outbox.status()).toMatchObject({ queued: 0, losses: [{ reason: 'invalid', count: 1 }] })
  recovered.observe(signal, 'fresh')
  recovered.observe({ timestamp, event: 'Music' }, 'end')
  await recovered.service.flush()
  expect(recovered.send).toHaveBeenCalledOnce()
  expect(recovered.outbox.status().losses).toMatchObject([{ reason: 'invalid', count: 1 }])
})

test('a corrupt appended checkpoint is discarded, without blocking later uploads', async () => {
  const { path } = disk()
  const first = fixture(path)
  first.observe(signal, 'first')
  first.connection.prepare('UPDATE eddn_signal_checkpoints SET document = ?').run('{broken')
  await first.crash()
  const recovered = fixture(path, first.settings)
  await recovered.service.flush()
  expect(recovered.send).not.toHaveBeenCalled()
  expect(recovered.outbox.status()).toMatchObject({ queued: 0, losses: [{ reason: 'invalid', count: 1 }] })
  recovered.observe(signal, 'fresh')
  recovered.observe({ timestamp, event: 'Music' }, 'close')
  await recovered.service.flush()
  expect(recovered.send).toHaveBeenCalledOnce()
})

test.each(['disabled', 'unavailable', 'expired'] as const)('recovery respects %s policy', async policy => {
  const { path } = disk()
  const first = fixture(path)
  first.observe(signal, 'first')
  await first.crash()
  if (policy === 'disabled') {
    const settings = first.settings.loadOrCreate()
    first.settings.save({ ...settings, community: { eddnEnabled: false, eddnChangedAt: now + 1000 } })
  }
  const recovered = fixture(path, first.settings, policy === 'expired' ? now + EDDN_MAX_AGE_MS : now)
  if (policy === 'unavailable') {
    await recovered.service.stop()
    const held = new EddnContributionService({ mode: 'unavailable', version: '0.1.5', outbox: recovered.outbox,
      settings: first.settings, transport: { send: recovered.send }, valid: message => validator.valid(message),
      readSnapshot: () => undefined, now: () => now })
    held.start()
    await held.flush()
    await held.stop()
  } else await recovered.service.flush()
  expect(recovered.send).not.toHaveBeenCalled()
  expect(recovered.outbox.status()).toMatchObject({ queued: 0, losses: [{ reason: policy === 'expired' ? 'expired' : 'cleared', count: 1 }] })
})

test('a failed closing checkpoint retries the captured context, not a later system', async () => {
  const f = fixture()
  f.observe(signal, 'first')
  vi.spyOn(f.outbox, 'sealSignals').mockImplementationOnce(() => { throw new Error('synthetic write failure') })
  f.observe({ ...location, event: 'StartJump', JumpType: 'Hyperspace' }, 'leave')
  expect(f.outbox.next(now)).toBeUndefined()
  f.observe({ ...location, event: 'FSDJump', StarSystem: 'Other', SystemAddress: 456 }, 'arrive')
  await f.service.flush()
  await f.service.flush()
  const batch = f.send.mock.calls.map(call => call[0]).find(message => message.message.signals)
  expect(batch.message).toMatchObject({ StarSystem: 'Sol', SystemAddress: 123, signals: [{ timestamp, SignalName: 'Public' }] })
})

test('failed per-signal checkpoint keeps memory for a later closing retry', async () => {
  const f = fixture()
  f.observe(signal, 'first')
  vi.spyOn(f.outbox, 'checkpointSignals').mockImplementationOnce(() => { throw new Error('private storage path') })
  f.observe({ ...signal, SignalName: 'Second' }, 'second')
  expect(f.service.status().error).not.toContain('private storage path')
  f.observe({ timestamp, event: 'Music' }, 'close')
  await f.service.flush()
  expect(f.send.mock.calls[0][0].message.signals).toHaveLength(2)
})

test('worker retries a failed seal without sending the still-open checkpoint', async () => {
  const f = fixture()
  f.observe(signal, 'first')
  vi.spyOn(f.outbox, 'sealSignals').mockImplementationOnce(() => { throw new Error('synthetic seal failure') })
  f.observe({ timestamp, event: 'Music' }, 'close')
  expect(f.outbox.next(now)).toBeUndefined()
  await f.service.flush()
  expect(f.send).toHaveBeenCalledOnce()
  expect(f.outbox.status().queued).toBe(0)
})

test('closing retries invalidation after an oversized run could not update its draft', async () => {
  const f = fixture()
  f.observe(signal, 'first')
  vi.spyOn(f.outbox, 'discardSignals').mockImplementationOnce(() => { throw new Error('synthetic failed invalidation') })
  f.observe({ ...signal, SignalName: 's'.repeat(EDDN_MAX_MESSAGE_BYTES) }, 'oversized')
  f.observe({ timestamp, event: 'Music' }, 'close')
  expect(f.outbox.status()).toMatchObject({ queued: 0, losses: [{ reason: 'invalid', count: 1 }] })
  await f.service.flush()
  expect(f.send).not.toHaveBeenCalled()
})

test('failed session discard retains its ID until storage recovers, without retaining old context', async () => {
  const { path } = disk()
  const f = fixture(path)
  f.observe(signal, 'old')
  f.connection.exec(`CREATE TRIGGER fail_discard BEFORE INSERT ON eddn_losses BEGIN SELECT RAISE(ABORT, 'Synthetic discard failure'); END`)
  f.observe({ ...load, Commander: 'Other' }, 'new-session')
  expect(f.outbox.status().queued).toBe(1)
  f.connection.exec('DROP TRIGGER fail_discard')
  await f.service.flush()
  expect(f.outbox.status()).toMatchObject({ queued: 0, losses: [{ reason: 'cleared', count: 1 }] })
  await f.crash()
  const recovered = fixture(path, f.settings)
  await recovered.service.flush()
  expect(recovered.send).not.toHaveBeenCalled()
})

test('worker removes an opted-out future-tolerated draft after preference clears fail', async () => {
  const { path } = disk()
  const f = fixture(path)
  f.observe({ ...signal, timestamp: new Date(now + 60_000).toISOString() }, 'future')
  const clear = vi.spyOn(f.outbox, 'clear').mockImplementation(() => { throw new Error('Synthetic failed clear') })
  f.service.setEnabled(false)
  f.service.setEnabled(true)
  clear.mockRestore()
  await f.service.flush()
  expect(f.outbox.status()).toMatchObject({ queued: 0, losses: [{ reason: 'cleared', count: 1 }] })
  await f.crash()
  const recovered = fixture(path, f.settings)
  await recovered.service.flush()
  expect(recovered.send).not.toHaveBeenCalled()
})

test('worker retries failed oversize invalidation while idle and suppresses its tail', async () => {
  const f = fixture()
  f.observe(signal, 'first')
  const discard = vi.spyOn(f.outbox, 'discardSignals').mockImplementation(() => { throw new Error('Synthetic invalidation failure') })
  f.observe({ ...signal, SignalName: 's'.repeat(EDDN_MAX_MESSAGE_BYTES) }, 'oversized')
  discard.mockRestore()
  await f.service.flush()
  expect(f.outbox.status()).toMatchObject({ queued: 0, losses: [{ reason: 'invalid', count: 1 }] })
  f.observe(signal, 'rejected-tail')
  await f.service.flush()
  expect(f.outbox.status().queued).toBe(0)
  expect(f.send).not.toHaveBeenCalled()
  f.observe({ timestamp, event: 'Music' }, 'close')
  f.observe(signal, 'next-run')
  f.observe({ timestamp, event: 'Music' }, 'close-next')
  await f.service.flush()
  expect(f.send).toHaveBeenCalledOnce()
  expect(f.outbox.status().losses).toMatchObject([{ reason: 'invalid', count: 1 }])
})

test('worker retries capacity rejection after accounting failure without another journal event', async () => {
  const { path } = disk()
  const f = fixture(path)
  f.observe(signal, 'first')
  const builder = new EddnMessageBuilder('0.1.5')
  for (const event of [header, load, location]) builder.observe(event)
  const envelope = builder.signals([signal])!
  f.outbox.enqueue('budget-filler', { ...envelope, message: { text: 's'.repeat(16 * 1024 * 1024 - 2048) } }, now)
  f.connection.exec(`CREATE TRIGGER fail_capacity BEFORE INSERT ON eddn_losses BEGIN SELECT RAISE(ABORT, 'Synthetic accounting failure'); END`)
  f.observe({ ...signal, SignalName: 's'.repeat(4096) }, 'rejected')
  expect(f.connection.prepare('SELECT id FROM eddn_outbox WHERE ready = 0').get()).toEqual({ id: 'signals:first' })
  f.connection.exec('DROP TRIGGER fail_capacity')
  // Isolate cleanup from delivery of the synthetic budget-filling row.
  const next = vi.spyOn(f.outbox, 'next').mockReturnValue(undefined)
  await f.service.flush()
  expect(f.outbox.status()).toMatchObject({ queued: 1, losses: [{ reason: 'capacity', count: 1 }] })
  f.observe(signal, 'rejected-tail')
  expect(f.connection.prepare('SELECT id FROM eddn_outbox WHERE ready = 0').get()).toBeUndefined()
  next.mockRestore()
  f.outbox.acknowledge('budget-filler', now)
  await f.crash()
  const recovered = fixture(path, f.settings)
  await recovered.service.flush()
  expect(recovered.send).not.toHaveBeenCalled()
  expect(recovered.outbox.status().losses).toMatchObject([{ reason: 'capacity', count: 1 }])
})

test.each(['reset', 'oversize'] as const)('duplicate %s cannot delete a sealed original or its retry lease', async boundary => {
  const f = fixture()
  f.observe(signal, 'first')
  f.observe({ timestamp, event: 'Music' }, 'close')
  f.send.mockResolvedValueOnce({ status: 503 })
  await f.service.flush()
  const before = f.outbox.next(now + 60_000)
  f.observe(signal, 'first')
  if (boundary === 'reset') f.observe({ timestamp, event: 'Music', MusicTrack: 'MainMenu' }, 'reset')
  else {
    f.observe({ ...signal, SignalName: 's'.repeat(EDDN_MAX_MESSAGE_BYTES) }, 'oversized')
    f.observe({ timestamp, event: 'Music' }, 'close-again')
  }
  expect(f.outbox.next(now + 60_000)).toEqual(before)
  expect(f.outbox.status()).toMatchObject({ queued: 1, losses: [] })
})

test('a busy run processes linear signal input and collapses checkpoints on closure', async () => {
  const f = fixture()
  const build = vi.spyOn(EddnMessageBuilder.prototype, 'signals')
  try {
    const count = 1000
    for (let index = 0; index < count; index++) f.observe({ ...signal, SignalName: `Public ${index}` }, String(index))
    expect(build.mock.calls.reduce((total, [events]) => total + events.length, 0)).toBe(count)
    expect(f.outbox.next(now)).toBeUndefined()
    f.observe({ timestamp, event: 'Music' }, 'close')
    expect(build.mock.calls.reduce((total, [events]) => total + events.length, 0)).toBe(count * 2)
    expect(f.connection.prepare('SELECT COUNT(*) AS count FROM eddn_signal_checkpoints').get()).toEqual({ count: 0 })
    await f.service.flush()
    expect(f.send).toHaveBeenCalledOnce()
    expect(f.send.mock.calls[0][0].message.signals).toHaveLength(count)
  } finally { build.mockRestore() }
})

test('real journal rotation resets an open run and fresh-session signals still contribute', async () => {
  const { directory } = disk()
  const f = fixture()
  const path = join(directory, 'Journal.2026-10-04T180000.01.log')
  const lines = (events: EliteJournalEvent[]) => events.map(event => JSON.stringify(event) + '\n').join('')
  writeFileSync(path, lines([header, load, location]))
  const source = new EliteJournalFileSource(directory, () => {}, { onObservation: (event, origin) => f.service.observe(event, origin) })
  cleanup.push(async () => { await source.stop() })
  await source.refresh()
  appendFileSync(path, lines([signal]))
  await source.refresh()
  expect(f.outbox.status().queued).toBe(1)
  expect(f.outbox.next(now)).toBeUndefined()
  writeFileSync(join(directory, 'Journal.2026-10-04T180001.01.log'), lines([
    header, load, { timestamp, event: 'StartJump', JumpType: 'Hyperspace' },
    { ...signal, SignalName: 'New session' }, location, { timestamp, event: 'Music' }
  ]))
  await source.refresh()
  await f.service.flush()
  await f.service.flush()
  expect(f.send).toHaveBeenCalledTimes(2)
  const batch = f.send.mock.calls.map(call => call[0]).find(message => message.message.signals)
  expect(batch.message.signals).toEqual([{ timestamp, SignalName: 'New session' }])
  expect(f.outbox.status().losses).toMatchObject([{ reason: 'cleared', count: 1 }])
})
