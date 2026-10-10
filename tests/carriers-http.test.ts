import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { PhoenixApplication } from '../apps/server/src/phoenix-application.js'
import { PhoenixApiClient } from '../apps/web/src/platform/api/phoenix-api-client.js'

test('carrier purchase/location/fuel enter the central journal fleet API and persist idempotently across restart', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'phoenix-carrier-http-'))
  writeFileSync(join(directory, 'Journal.20261010100000.01.log'), [
    { timestamp: '2026-10-10T10:00:00Z', event: 'CarrierBuy', CarrierID: 42, Callsign: 'SYN-001', Location: 'Sol', SystemAddress: 1, Price: 5000000000 },
    { timestamp: '2026-10-10T10:01:00Z', event: 'CarrierDepositFuel', CarrierID: 42, Amount: 500, Total: 500 },
    { timestamp: '2026-10-10T10:02:00Z', event: 'CarrierLocation', CarrierID: 42, StarSystem: 'Colonia', SystemAddress: 2 },
    { timestamp: '2026-10-10T10:03:00Z', event: 'CarrierDepositFuel', CarrierID: 99, Amount: 10, Total: 100 },
    { timestamp: '2026-10-10T10:04:00Z', event: 'StoredShips', StarSystem: 'Colonia', StationName: 'SYN-001', MarketID: 42, ShipsHere: [{ ShipID: 3, ShipType: 'SideWinder', Value: 30000, Hot: false }], ShipsRemote: [] }
  ].map(event => JSON.stringify(event)).join('\n') + '\n')
  const options = { databasePath: join(directory, 'state.sqlite'), eliteDirectory: directory, host: '127.0.0.1', port: 0, copilot: null, copilotRealtime: null, openAiEnvironmentKey: null }
  let app = new PhoenixApplication(options)
  try {
    const address = await app.start()
    const client = new PhoenixApiClient(`http://${address.host}:${address.port}`)
    const before = await client.getFleet()
    expect(before.carriers).toMatchObject({ observed: true, items: [{ id: 42, location: { system: 'Colonia' }, fuel: { tonnes: 500 }, finance: null }] })
    expect(before.carriers.items).toHaveLength(1)
    expect(before.ships).toMatchObject([{ id: 3, marketId: 42, state: 'stored-here' }])
    await app.stop()
    app = new PhoenixApplication(options)
    const reopened = await app.start()
    expect(await new PhoenixApiClient(`http://${reopened.host}:${reopened.port}`).getFleet()).toEqual(before)
  } finally { await app.stop(); rmSync(directory, { recursive: true, force: true }) }
})
