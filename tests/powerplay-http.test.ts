import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { PhoenixApplication } from '../apps/server/src/phoenix-application.js'
import { PairingAccessController } from '../apps/server/src/infrastructure/pairing-access-controller.js'
import { PhoenixApiClient } from '../apps/web/src/platform/api/phoenix-api-client.js'

let directory: string
let app: PhoenixApplication
let options: ConstructorParameters<typeof PhoenixApplication>[0]
let origin: string
let request: typeof fetch
let client: PhoenixApiClient

beforeEach(async () => {
  directory = mkdtempSync(join(tmpdir(), 'phoenix-powerplay-http-'))
  writeFileSync(join(directory, 'Journal.20261010100000.01.log'), [
    { timestamp: '2026-10-10T10:00:00Z', event: 'Powerplay', Power: 'Aisling Duval', Rank: 3, Merits: 5200, TimePledged: 86400 },
    { timestamp: '2026-10-10T10:01:00Z', event: 'PowerplayMerits', Power: 'Aisling Duval', MeritsGained: 25.5, TotalMerits: 5225.5 }
  ].map(event => JSON.stringify(event)).join('\n') + '\n')
  const access = new PairingAccessController(join(directory, 'pairing.json'))
  options = { databasePath: join(directory, 'state.sqlite'), eliteDirectory: directory,
    host: '127.0.0.1', port: 0, copilot: null, copilotRealtime: null,
    openAiEnvironmentKey: null, accessControl: access }
  app = new PhoenixApplication(options)
  const address = await app.start()
  origin = `http://${address.host}:${address.port}`
  const claim = await fetch(origin + '/api/pairing/claim', { method: 'POST', body: JSON.stringify({ code: access.pairingCode }) })
  const cookie = claim.headers.get('set-cookie')!.split(';')[0]!
  request = (input, init) => fetch(input, { ...init, headers: { ...init?.headers, cookie } })
  client = new PhoenixApiClient(origin, request)
})

afterEach(async () => {
  try { await app.stop() } finally { rmSync(directory, { recursive: true, force: true }) }
})

test('central journal ingestion exposes paired Powerplay reads and validated target writes', async () => {
  expect((await fetch(origin + '/api/operations/powerplay')).status).toBe(401)
  expect((await fetch(origin + '/api/operations/powerplay/target', { method: 'PUT', body: 'null' })).status).toBe(401)
  expect((await client.getPowerplay()).pledge).toMatchObject({ power: 'Aisling Duval', rank: 3, merits: 5225.5 })
  for (const input of [{ name: '', power: 'Aisling Duval', rank: 4, merits: null },
    { name: 'Target', power: 'Aisling Duval', rank: 4.5, merits: null },
    { name: 'Target', power: 'Aisling Duval', rank: null, merits: null }]) {
    expect((await request(origin + '/api/operations/powerplay/target', { method: 'PUT', body: JSON.stringify(input) })).status).toBe(400)
  }
  const target = { name: 'Synthetic target', power: 'Aisling Duval', rank: 4, merits: 9000 }
  expect((await client.savePowerplayTarget(target)).target).toEqual(target)
})

test('Powerplay target and ingested merits survive an application restart and target clearing', async () => {
  const target = { name: 'Synthetic target', power: 'Aisling Duval', rank: 4, merits: 9000 }
  await client.savePowerplayTarget(target)
  await app.stop()
  app = new PhoenixApplication(options)
  const restarted = await app.start()
  const reopened = new PhoenixApiClient(`http://${restarted.host}:${restarted.port}`, request)
  expect(await reopened.getPowerplay()).toMatchObject({ target, retained: 2, pledge: { merits: 5225.5 } })
  expect((await reopened.savePowerplayTarget(null)).target).toBeNull()
})
