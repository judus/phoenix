import { expect, test } from 'vitest'
import { PHOENIX_API_VERSION, type CartographicSystem } from '@phoenix/contracts'
import { PhoenixApplication } from '../apps/server/src/phoenix-application.js'
import { PhoenixApiClient } from '../apps/web/src/api/phoenix-api-client.js'
import type { FactionPresenceSearchSource, OutfittingSearchSource, ShipyardSearchSource, StationLookupSource, StationSearchSource, SystemSearchSource } from '../apps/server/src/domain/station-market.js'

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
    }],
    findNearbySystems: async () => [{
      distanceLy: 4.37,
      position: [3.03125, -0.09375, 3.15625],
      systemAddress: 1178707802194,
      systemName: 'Alpha Centauri',
      updatedAt: '2026-08-13T08:00:00.000Z'
    }]
  }
  const shipyardSearchSource: ShipyardSearchSource = {
    findShipyards: async () => [{
      distanceLy: 4.2, distanceToArrivalLs: 300, marketId: 42, maxLandingPadSize: 3,
      price: 67861851, shipSymbol: 'LakonMiner', stationName: 'Test Exchange', stationType: 'Orbis',
      systemName: 'Nearby', updatedAt: '2026-08-13T08:00:00.000Z'
    }]
  }
  const outfittingSearchSource: OutfittingSearchSource = {
    findOutfitting: async request => [{
      category: 'standard', distanceLy: 4.2, distanceToArrivalLs: 300, marketId: 42,
      maxLandingPadSize: 3, moduleClass: request.moduleClass, moduleName: request.moduleName,
      moduleRating: request.moduleRating, moduleSymbol: 'int_powerplant_size6_class5', price: 16257880,
      ship: null, stationName: 'Test Exchange', stationType: 'Orbis', systemName: 'Nearby',
      updatedAt: '2026-08-15T08:00:00.000Z'
    }]
  }
  const stationLookupSource: StationLookupSource = {
    findStations: async () => [{
      allegiance: 'Independent', controllingFaction: 'Test Faction', distanceLy: 4.2,
      distanceToArrivalLs: 300, government: 'Democracy', marketId: 42,
      maxLandingPadSize: 3, primaryEconomy: 'Industrial', secondaryEconomy: null,
      services: ['Dock', 'Repair'], stationName: 'Test Exchange', stationType: 'Orbis',
      systemName: 'Nearby', updatedAt: '2026-08-15T08:00:00.000Z'
    }]
  }
  const systemSearchSource: SystemSearchSource = {
    findSystems: async () => [{
      allegiance: 'Federation', controllingFaction: 'Mother Gaia', distanceLy: 4.37, economy: 'High Tech',
      government: 'Democracy', inhabited: true, permitRequired: false, population: 230000,
      position: [3.03125, -0.09375, 3.15625], primaryStarClass: 'G (White-Yellow) Star',
      secondaryEconomy: 'Service', security: 'High', systemAddress: 1178707802194,
      systemName: 'Alpha Centauri', updatedAt: '2026-08-15T08:00:00.000Z'
    }]
  }
  const factionPresenceSource: FactionPresenceSearchSource = {
    findFactionPresences: async request => [{
      activeStates: ['Boom'], allegiance: 'Federation', controlling: true, distanceLy: 4.37,
      factionName: request.factionName, government: 'Democracy', influencePercent: 42.15,
      pendingStates: ['Expansion'], position: [3.03125, -0.09375, 3.15625], recoveringStates: [],
      state: 'Boom', systemAddress: 1178707802194, systemName: 'Alpha Centauri',
      updatedAt: '2026-08-15T08:00:00.000Z'
    }]
  }
  const application = new PhoenixApplication({
    databasePath: ':memory:',
    eliteDirectory: null,
    host: '127.0.0.1',
    port: 0,
    stationSearchSource,
    shipyardSearchSource,
    outfittingSearchSource,
    stationLookupSource,
    systemSearchSource,
    factionPresenceSource,
    cartographySource: { fetchSystem: async () => fixtureSystem() }
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
    await expect(client.findGalaxyNearbySystems({ maxDistance: 25, systemName: 'Sol' }))
      .resolves.toMatchObject({ maxDistanceLy: 25, systems: [{ systemName: 'Alpha Centauri' }] })
    await expect(client.findGalaxyShipyards({ hullName: 'Type-11 Prospector', systemName: 'Sol' }))
      .resolves.toMatchObject({ hullName: 'Type-11 Prospector', shipyards: [{ stationName: 'Test Exchange' }] })
    await expect(client.findGalaxyOutfitting({ maxDaysAgo: 30, maxDistance: 100, minimumPadSize: 'large', module: '6A Power Plant', systemName: 'Sol' }))
      .resolves.toMatchObject({ moduleClass: 6, moduleName: 'Power Plant', moduleRating: 'A', matches: [{ stationName: 'Test Exchange' }] })
    await expect(client.findGalaxyStations({ maxDistance: 100, minimumPadSize: 'large', name: 'Test', stationType: 'orbital', systemName: 'Sol' }))
      .resolves.toMatchObject({ name: 'Test', stationType: 'orbital', matches: [{ stationName: 'Test Exchange', services: ['Dock', 'Repair'] }] })
    await expect(client.findGalaxyFilteredSystems({ allegiance: 'Federation', maxDistance: 100, population: 'inhabited', systemName: 'Sol' }))
      .resolves.toMatchObject({ filters: { allegiance: 'Federation', population: 'inhabited' }, systems: [{ systemName: 'Alpha Centauri' }] })
    await expect(client.findGalaxyFactionPresences({ controlling: 'yes', factionName: 'Mother Gaia', maxDistance: 100, minInfluence: 25, systemName: 'Sol' }))
      .resolves.toMatchObject({ filters: { controlling: 'yes', factionName: 'Mother Gaia', minInfluencePercent: 25 }, presences: [{ controlling: true, influencePercent: 42.15, systemName: 'Alpha Centauri' }], provenance: 'Spansh community-reported system data' })
  } finally {
    await application.stop()
  }
})

function fixtureSystem (): CartographicSystem {
  return {
    schemaVersion: 1,
    name: 'Sol',
    address: 10477373803,
    position: [0, 0, 0],
    permitRequired: null,
    permitName: null,
    information: {
      allegiance: null, government: null, security: null, state: null, primaryEconomy: null,
      secondaryEconomy: null, population: null, controllingFaction: null
    },
    primaryStar: null,
    bodies: [],
    stations: [],
    scanProgress: { knownBodies: 0, reportedBodies: null, percent: null },
    localSystem: null,
    source: { provider: 'edsm', fetchedAt: '2026-08-15T00:00:00.000Z' },
    raw: { system: {}, bodies: {}, stations: {} }
  }
}
