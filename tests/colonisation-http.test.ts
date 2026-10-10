import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { PhoenixApplication } from '../apps/server/src/phoenix-application.js'
import { PhoenixApiClient } from '../apps/web/src/platform/api/phoenix-api-client.js'

test('colonisation uses central journal location context and remains durable and replay-idempotent', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'phoenix-colonisation-http-'))
  writeFileSync(join(directory, 'Journal.20261010100000.01.log'), [
    { timestamp: '2026-10-10T10:00:00Z', event: 'Location', StarSystem: 'Synthetic colony', SystemAddress: 42, Docked: true, StationName: 'Synthetic depot', StationType: 'ConstructionDepot', MarketID: 99 },
    { timestamp: '2026-10-10T10:01:00Z', event: 'ColonisationConstructionDepot', MarketID: 99, ConstructionProgress: 0.5, ConstructionComplete: false, ConstructionFailed: false,
      ResourcesRequired: [{ Name: 'steel', Name_Localised: 'Steel', RequiredAmount: 200, ProvidedAmount: 100, Payment: 1000 }] },
    { timestamp: '2026-10-10T10:02:00Z', event: 'ColonisationContribution', MarketID: 99, Contributions: [{ Name: 'steel', Name_Localised: 'Steel', Amount: 20 }] }
  ].map(event => JSON.stringify(event)).join('\n') + '\n')
  const options = { databasePath: join(directory, 'state.sqlite'), eliteDirectory: directory, host: '127.0.0.1', port: 0,
    copilot: null, copilotRealtime: null, openAiEnvironmentKey: null }
  let app = new PhoenixApplication(options)
  try {
    const address = await app.start()
    const client = new PhoenixApiClient(`http://${address.host}:${address.port}`)
    const before = await client.getColonisation()
    expect(before).toMatchObject({ depots: [{ marketId: 99, system: 'Synthetic colony', station: 'Synthetic depot', resources: [{ provided: 100 }] }], claims: [], retainedContributions: 1 })
    await app.stop()
    app = new PhoenixApplication(options)
    const reopened = await app.start()
    expect(await new PhoenixApiClient(`http://${reopened.host}:${reopened.port}`).getColonisation()).toEqual(before)
  } finally { await app.stop(); rmSync(directory, { recursive: true, force: true }) }
})
