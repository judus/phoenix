import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { PhoenixApplication } from '../apps/server/src/phoenix-application.js'
import { PairingAccessController } from '../apps/server/src/infrastructure/pairing-access-controller.js'
import { PhoenixApiClient } from '../apps/web/src/platform/api/phoenix-api-client.js'

test('central journal ingestion exposes paired Powerplay reads and validated durable target writes', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'phoenix-powerplay-http-'))
  writeFileSync(join(directory, 'Journal.20261010100000.01.log'), [
    { timestamp: '2026-10-10T10:00:00Z', event: 'Powerplay', Power: 'Aisling Duval', Rank: 3, Merits: 5200, TimePledged: 86400 },
    { timestamp: '2026-10-10T10:01:00Z', event: 'PowerplayMerits', Power: 'Aisling Duval', MeritsGained: 25.5, TotalMerits: 5225.5 }
  ].map(event => JSON.stringify(event)).join('\n') + '\n')
  const access = new PairingAccessController(join(directory, 'pairing.json'))
  const options = { databasePath: join(directory, 'state.sqlite'), eliteDirectory: directory,
    host: '127.0.0.1', port: 0, copilot: null, copilotRealtime: null,
    openAiEnvironmentKey: null, accessControl: access }
  let app = new PhoenixApplication(options)
  try {
    const address = await app.start()
    const origin = `http://${address.host}:${address.port}`
    expect((await fetch(origin + '/api/operations/powerplay')).status).toBe(401)
    expect((await fetch(origin + '/api/operations/powerplay/target', { method: 'PUT', body: 'null' })).status).toBe(401)
    const claim = await fetch(origin + '/api/pairing/claim', { method: 'POST', body: JSON.stringify({ code: access.pairingCode }) })
    const cookie = claim.headers.get('set-cookie')!.split(';')[0]!
    const request: typeof fetch = (input, init) => fetch(input, { ...init, headers: { ...init?.headers, cookie } })
    const client = new PhoenixApiClient(origin, request)
    expect((await client.getPowerplay()).pledge).toMatchObject({ power: 'Aisling Duval', rank: 3, merits: 5225.5 })
    for (const input of [{ name: '', power: 'Aisling Duval', rank: 4, merits: null },
      { name: 'Target', power: 'Aisling Duval', rank: 4.5, merits: null },
      { name: 'Target', power: 'Aisling Duval', rank: null, merits: null }]) {
      expect((await request(origin + '/api/operations/powerplay/target', { method: 'PUT', body: JSON.stringify(input) })).status).toBe(400)
    }
    const target = { name: 'Synthetic target', power: 'Aisling Duval', rank: 4, merits: 9000 }
    expect((await client.savePowerplayTarget(target)).target).toEqual(target)
    await app.stop()
    app = new PhoenixApplication(options)
    const restarted = await app.start()
    const reopened = new PhoenixApiClient(`http://${restarted.host}:${restarted.port}`, request)
    expect(await reopened.getPowerplay()).toMatchObject({ target, retained: 2, pledge: { merits: 5225.5 } })
    expect((await reopened.savePowerplayTarget(null)).target).toBeNull()
  } finally { await app.stop(); rmSync(directory, { recursive: true, force: true }) }
})
