import { appendFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { EliteJournalFileSource, type EliteJournalEvent } from '@phoenix/elite'
import { EddnContributionService } from '../apps/server/src/application/eddn-contribution-service.js'
import { EDDN_MAX_AGE_MS, type EddnMode } from '../apps/server/src/domain/eddn.js'
import { SqliteEddnOutbox } from '../apps/server/src/infrastructure/sqlite-eddn-outbox.js'
import { EddnSchemaValidator } from '../apps/server/src/infrastructure/eddn-schema-validator.js'
import { InMemorySystemSettingsRepository } from '../apps/server/src/infrastructure/json-system-configuration.js'

const start = Date.parse('2026-10-07T00:00:00Z')
const timestamp = new Date(start).toISOString()
const header = { timestamp, event: 'Fileheader', gameversion: '4.0', build: 'r1' }
const load = { timestamp, event: 'LoadGame', Commander: 'Synthetic', Horizons: true, Odyssey: true }
const location = { timestamp, event: 'Location', StarSystem: 'Synthetic', SystemAddress: 123, StarPos: [0, 0, 0] }
const validator = new EddnSchemaValidator('resources/eddn')
const cleanup: Array<() => Promise<void>> = []
beforeEach(() => vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] }))
afterEach(async () => {
  try { for (const close of cleanup.splice(0).reverse()) await close() }
  finally { vi.useRealTimers() }
})

function disk () {
  const directory = mkdtempSync(join(tmpdir(), 'phoenix-eddn-offline-'))
  cleanup.push(async () => rmSync(directory, { recursive: true, force: true }))
  return { directory, path: join(directory, 'outbox.sqlite') }
}

function fixture (path: string, clock: { now: number }, mode: EddnMode = 'test') {
  const connection = new DatabaseSync(path)
  const outbox = new SqliteEddnOutbox(connection)
  const send = vi.fn().mockResolvedValue({ status: 200 })
  const readSnapshot = vi.fn(() => undefined)
  const service = new EddnContributionService({ mode, version: '0.1.5', outbox,
    settings: new InMemorySystemSettingsRepository(), transport: { send }, readSnapshot,
    valid: message => validator.valid(message), now: () => clock.now })
  service.start()
  let closed = false
  const close = async () => {
    if (closed) return
    await service.stop()
    connection.close()
    closed = true
  }
  cleanup.push(close)
  for (const event of [header, load, location]) service.observe(event, { id: event.event, replayed: true })
  return { service, outbox, connection, send, readSnapshot, close }
}

function lines (events: EliteJournalEvent[]): string { return events.map(event => JSON.stringify(event) + '\n').join('') }

test('reopen retries admitted work but never uploads journal records written while PHOENIX was closed', async () => {
  const { directory, path } = disk()
  const clock = { now: start }
  const journal = join(directory, 'Journal.2026-10-07T000000.01.log')
  writeFileSync(journal, lines([header, load, location]))
  const first = fixture(path, clock)
  const source = new EliteJournalFileSource(directory, () => {}, {
    onObservation: (event, origin) => first.service.observe(event, origin)
  })
  cleanup.push(() => source.stop())
  await source.refresh()
  const beforeClose = { timestamp, event: 'Scan', SystemAddress: 123, BodyName: 'Synthetic before close' }
  appendFileSync(journal, lines([beforeClose]))
  await source.refresh()
  expect(first.service.status().queued).toBe(1)
  await source.stop()
  await first.close()

  clock.now += 60_000
  appendFileSync(journal, lines([
    { ...beforeClose, timestamp: new Date(clock.now).toISOString(), BodyName: 'Synthetic while closed' },
    { timestamp: new Date(clock.now).toISOString(), event: 'Market', MarketID: 42 }
  ]))
  const recovered = fixture(path, clock)
  const restartedSource = new EliteJournalFileSource(directory, () => {}, {
    onObservation: (event, origin) => recovered.service.observe(event, origin)
  })
  cleanup.push(() => restartedSource.stop())
  await restartedSource.refresh()
  expect(recovered.readSnapshot).not.toHaveBeenCalled()
  expect(recovered.service.status().queued).toBe(1)
  await recovered.service.flush()
  expect(recovered.send).toHaveBeenCalledOnce()
  expect(recovered.send.mock.calls[0][0].message).toMatchObject(beforeClose)

  const live = { ...beforeClose, timestamp: new Date(clock.now).toISOString(), BodyName: 'Synthetic after reopen' }
  appendFileSync(journal, lines([live]))
  await restartedSource.refresh()
  await recovered.service.flush()
  expect(recovered.send).toHaveBeenCalledTimes(2)
  expect(recovered.send.mock.calls[1][0].message).toMatchObject(live)
  expect(recovered.service.status()).toMatchObject({ queued: 0, losses: [] })
})

test('network retry deadline survives database reopen; other due work is not blocked', async () => {
  const { path } = disk()
  const clock = { now: start }
  const first = fixture(path, clock)
  first.send.mockRejectedValueOnce(new Error('Synthetic offline network'))
  first.service.observe({ ...location, event: 'FSDJump' }, { id: 'offline', replayed: false })
  await first.service.flush()
  expect(first.service.submissionLog().entries[0]).toMatchObject({ outcome: 'retry', attempt: 1,
    retryAt: new Date(start + 60_000).toISOString() })
  await first.close()

  clock.now += 59_999
  const recovered = fixture(path, clock)
  await recovered.service.flush()
  expect(recovered.send).not.toHaveBeenCalled()
  recovered.service.observe({ ...location, timestamp: new Date(clock.now).toISOString(), event: 'FSDJump' }, { id: 'fresh', replayed: false })
  await recovered.service.flush()
  expect(recovered.send).toHaveBeenCalledOnce()
  expect(recovered.service.status().queued).toBe(1)
  clock.now++
  await recovered.service.flush()
  expect(recovered.send).toHaveBeenCalledTimes(2)
  expect(recovered.send.mock.calls[1][0].message.timestamp).toBe(timestamp)
  expect(recovered.service.submissionLog().entries[0]).toMatchObject({ outcome: 'accepted', attempt: 2 })
})

test.each(['observation', 'admission'] as const)('%s age reaches its limit independently after reopen', async age => {
  const { path } = disk()
  const clock = { now: start }
  const first = fixture(path, clock)
  // An old-but-still-fresh observation, or an admitted observation just inside future tolerance.
  const observedAt = start + (age === 'observation' ? -EDDN_MAX_AGE_MS + 60_000 : 60_000)
  first.service.observe({ ...location, timestamp: new Date(observedAt).toISOString(), event: 'FSDJump' }, { id: 'pending', replayed: false })
  expect(first.service.status().queued).toBe(1)
  await first.close()
  clock.now += age === 'observation' ? 60_000 : EDDN_MAX_AGE_MS
  const recovered = fixture(path, clock)
  await recovered.service.flush()
  expect(recovered.send).not.toHaveBeenCalled()
  expect(recovered.service.status()).toMatchObject({ queued: 0, losses: [{ reason: 'expired', count: 1 }] })
  await recovered.service.flush()
  expect(recovered.service.status().losses).toMatchObject([{ reason: 'expired', count: 1 }])
})

test('a gated build clears persisted pending work instead of promising to hold it for release', async () => {
  const { path } = disk()
  const clock = { now: start }
  const first = fixture(path, clock)
  first.service.observe(location, { id: 'pending', replayed: false })
  await first.close()
  const gated = fixture(path, clock, 'unavailable')
  await gated.service.flush()
  expect(gated.send).not.toHaveBeenCalled()
  expect(gated.service.status()).toMatchObject({ enabled: true, mode: 'unavailable', queued: 0,
    losses: [{ reason: 'cleared', count: 1 }] })
  expect(gated.service.status().detail).toBe('Enabled by preference. Uploads are disabled in this build; pending uploads are cleared.')
})
