import { expect, test } from 'vitest'
import { PHOENIX_API_VERSION } from '@phoenix/contracts'
import { PhoenixApplication } from '../apps/server/src/phoenix-application.js'
import { PhoenixApiClient } from '../apps/web/src/api/phoenix-api-client.js'
import type { StationSearchSource } from '../apps/server/src/domain/station-market.js'

test('the frontend API client communicates with the PHOENIX backend', async () => {
  const stationSearchSource: StationSearchSource = {
    findCommodityMarkets: async request => [{
      buyPrice: 1000, commodityName: request.commodity, demand: 50, distanceLy: 4.2,
      distanceToArrivalLs: 300, marketId: 42, maxLandingPadSize: 3, meanPrice: 1200,
      sellPrice: 1500, stationName: 'Test Exchange', stationType: 'Orbis', stock: 100,
      systemName: 'Nearby', updatedAt: '2026-08-13T08:00:00.000Z'
    }],
    findNearestStations: async request => [{
      allegiance: null, controllingFaction: null, distanceLy: 4.2, distanceToArrivalLs: 300,
      government: null, marketId: 42, maxLandingPadSize: 3, primaryEconomy: 'Industrial',
      secondaryEconomy: null, stationName: 'Test Exchange', stationType: 'Orbis',
      systemName: 'Nearby', updatedAt: '2026-08-13T08:00:00.000Z'
    }]
  }
  const application = new PhoenixApplication({
    databasePath: ':memory:',
    eliteDirectory: null,
    host: '127.0.0.1',
    port: 0,
    stationSearchSource
  })
  const address = await application.start()

  try {
    const client = new PhoenixApiClient(`http://${address.host}:${address.port}`)
    const health = await client.getHealth()

    expect(health.status).toBe('ok')
    expect(health.apiVersion).toBe(PHOENIX_API_VERSION)
    expect(health.database).toEqual({ connected: true, engine: 'sqlite' })
    await expect(client.findGalaxyNearestStations({ service: 'repair', systemName: 'Sol' }))
      .resolves.toMatchObject({ originSystem: 'Sol', stations: [{ stationName: 'Test Exchange' }] })
    await expect(client.findGalaxyCommodityMarkets({ commodity: 'gold', intent: 'sell', systemName: 'Sol' }))
      .resolves.toMatchObject({ commodity: 'gold', intent: 'sell', markets: [{ sellPrice: 1500 }] })
  } finally {
    await application.stop()
  }
})
