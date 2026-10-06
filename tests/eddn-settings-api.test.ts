import { expect, test, vi } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { SqliteEddnOutbox } from '../apps/server/src/infrastructure/sqlite-eddn-outbox.js'
import { PhoenixApplication } from '../apps/server/src/phoenix-application.js'
import { PhoenixApiClient } from '../apps/web/src/platform/api/phoenix-api-client.js'
import { EddnContributionService } from '../apps/server/src/application/eddn-contribution-service.js'

test.each(['{', '', '   ', '{"enabled":"yes"}', '{}', 'null'])(
  'EDDN settings rejects invalid body %j before mutating preferences', async body => {
    const application = new PhoenixApplication({ databasePath: ':memory:', eliteDirectory: null,
      host: '127.0.0.1', port: 0, copilot: null, copilotRealtime: null })
    const setEnabled = vi.spyOn(EddnContributionService.prototype, 'setEnabled')
    try {
      const address = await application.start()
      const origin = `http://${address.host}:${address.port}`
      const response = await fetch(`${origin}/api/settings/eddn`, {
        method: 'PUT', headers: { 'content-type': 'application/json' }, body
      })
      expect(response.status).toBe(400)
      const result = await response.json() as { error: { code: string, message: string } }
      expect(result.error.code).toBe('invalid_request')
      expect(result.error.message.length).toBeGreaterThan(0)
      expect(setEnabled).not.toHaveBeenCalled()
      expect(await new PhoenixApiClient(origin).getEddnStatus()).toMatchObject({ enabled: true })
    } finally { setEnabled.mockRestore(); await application.stop() }
  }
)

test('EDDN settings keeps service failures separate from request validation', async () => {
  const application = new PhoenixApplication({ databasePath: ':memory:', eliteDirectory: null,
    host: '127.0.0.1', port: 0, copilot: null, copilotRealtime: null })
  const setEnabled = vi.spyOn(EddnContributionService.prototype, 'setEnabled')
    .mockImplementationOnce(() => { throw new Error('Synthetic preference storage failure') })
  try {
    const address = await application.start()
    const origin = `http://${address.host}:${address.port}`
    const response = await fetch(`${origin}/api/settings/eddn`, {
      method: 'PUT', headers: { 'content-type': 'application/json' }, body: '{"enabled":false}'
    })
    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: {
      code: 'internal_error', message: 'Synthetic preference storage failure'
    } })
    expect(setEnabled).toHaveBeenCalledExactlyOnceWith(false)
    const client = new PhoenixApiClient(origin)
    expect(await client.getEddnStatus()).toMatchObject({ enabled: true })
    expect(await client.saveEddnSettings({ enabled: false })).toMatchObject({ enabled: false })
  } finally { setEnabled.mockRestore(); await application.stop() }
})

test('EDDN settings accepts the JSON body limit and rejects larger requests without mutation', async () => {
  const application = new PhoenixApplication({ databasePath: ':memory:', eliteDirectory: null,
    host: '127.0.0.1', port: 0, copilot: null, copilotRealtime: null })
  const setEnabled = vi.spyOn(EddnContributionService.prototype, 'setEnabled')
  try {
    const address = await application.start()
    const origin = `http://${address.host}:${address.port}`
    const base = JSON.stringify({ enabled: false, padding: '' })
    const body = (size: number) => JSON.stringify({ enabled: false, padding: 'x'.repeat(size - Buffer.byteLength(base)) })
    const put = (size: number) => fetch(`${origin}/api/settings/eddn`, {
      method: 'PUT', headers: { 'content-type': 'application/json' }, body: body(size)
    })
    const valid = await put(64 * 1024)
    expect(valid.status).toBe(200)
    await expect(valid.json()).resolves.toMatchObject({ enabled: false })
    expect(setEnabled).toHaveBeenCalledExactlyOnceWith(false)
    setEnabled.mockClear()
    const oversized = await put(64 * 1024 + 1)
    expect(oversized.status).toBe(400)
    await expect(oversized.json()).resolves.toEqual({ error: {
      code: 'invalid_request', message: 'Request body exceeds 64 KiB.'
    } })
    expect(setEnabled).not.toHaveBeenCalled()
  } finally { setEnabled.mockRestore(); await application.stop() }
})

test('settings API defaults on, persists off and rejects invalid input', async () => {
  const application = new PhoenixApplication({ databasePath: ':memory:', eliteDirectory: null, host: '127.0.0.1', port: 0, copilot: null, copilotRealtime: null })
  const address = await application.start()
  const origin = `http://${address.host}:${address.port}`
  const client = new PhoenixApiClient(origin)
  try {
    expect(await client.getEddnStatus()).toMatchObject({ enabled: true, mode: 'unavailable', queued: 0 })
    expect(await client.getEddnSubmissions()).toMatchObject({ status: { enabled: true, mode: 'unavailable' }, entries: [] })
    expect((await fetch(`${origin}/api/developer/eddn/123`)).status).toBe(404)
    expect(await client.saveEddnSettings({ enabled: false })).toMatchObject({ enabled: false, queued: 0 })
    expect(await client.getEddnStatus()).toMatchObject({ enabled: false })
    expect((await fetch(`${origin}/api/settings/eddn`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: '{"enabled":"yes"}' })).status).toBe(400)
    expect(await client.getEddnStatus()).toMatchObject({ enabled: false })
  } finally { await application.stop() }
})

test('DEV API returns retained summaries and the exact filtered payload on demand', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'phoenix-eddn-api-'))
  const databasePath = join(directory, 'phoenix.sqlite')
  const application = new PhoenixApplication({ databasePath, eliteDirectory: null, host: '127.0.0.1', port: 0, copilot: null, copilotRealtime: null })
  try {
    const address = await application.start()
    const client = new PhoenixApiClient(`http://${address.host}:${address.port}`)
    const connection = new DatabaseSync(databasePath)
    let id: number
    const now = Date.now()
    const payload = { $schemaRef: 'https://eddn.edcd.io/schemas/journal/1/test',
      header: { softwareName: 'PHOENIX' as const, softwareVersion: '0.1.2', uploaderID: 'Test', gameversion: '4.0', gamebuild: 'r1' },
      message: { timestamp: new Date(now).toISOString(), event: 'Location', StarSystem: 'Sol' } }
    try {
      const outbox = new SqliteEddnOutbox(connection)
      outbox.enqueue('api-fixture', payload, now)
      id = outbox.beginAttempt('api-fixture', now + 75_000, now)
      outbox.finishAttempt(id, 'accepted', 200, now)
      outbox.acknowledge('api-fixture', now)
    } finally { connection.close() }
    const log = await client.getEddnSubmissions()
    expect(log.entries).toMatchObject([{ id, event: 'Location', system: 'Sol', outcome: 'accepted', httpStatus: 200 }])
    expect(log.entries[0]).not.toHaveProperty('payload')
    expect(await client.getEddnSubmission(id)).toEqual({ payload })
    await client.saveEddnSettings({ enabled: false })
    expect((await client.getEddnSubmissions()).entries).toHaveLength(1)
  } finally {
    await application.stop()
    rmSync(directory, { recursive: true, force: true })
  }
})
