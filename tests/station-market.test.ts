import { expect, test, vi } from 'vitest'
import { createEmptyRuntimeState, type CartographicSystem } from '@phoenix/contracts'
import { DefaultStationMarketQuery } from '../apps/server/src/application/default-station-market-query.js'
import type { SystemCartography } from '../apps/server/src/domain/cartography.js'
import type {
  CommodityMarket,
  CommodityMarketRequest,
  NearbySystem,
  NearbyStation,
  NearestStationRequest,
  OutfittingSearchSource,
  ProviderCacheEntry,
  ProviderResponseCache,
  ShipyardSearchSource,
  StationSearchSource,
  StationStockSource
} from '../apps/server/src/domain/station-market.js'
import { ArdentStationSearchSource } from '../apps/server/src/infrastructure/ardent-station-search-source.js'
import { EdsmStationStockSource } from '../apps/server/src/infrastructure/edsm-station-stock-source.js'
import { InMemoryRuntimeStateStore } from '../apps/server/src/infrastructure/in-memory-runtime-state-store.js'
import { SqliteDatabase } from '../apps/server/src/infrastructure/sqlite-database.js'
import { SpanshShipyardSearchSource } from '../apps/server/src/infrastructure/spansh-shipyard-search-source.js'
import { SpanshOutfittingSearchSource } from '../apps/server/src/infrastructure/spansh-outfitting-search-source.js'

test('Ardent source maps current station and commodity response contracts', async () => {
  const fetcher = vi.fn(async (input: string | URL | Request) => {
    const url = new URL(input instanceof Request ? input.url : input.toString())
    if (url.pathname.includes('/commodity/')) {
      return response([{ commodityName: 'gold', stationName: 'Galileo', systemName: 'Sol', marketId: 128016640, buyPrice: 4000, sellPrice: 3900, meanPrice: 50000, stock: 25, demand: 3, distance: 0, distanceToArrival: 495.3, updatedAt: '2026-08-11T02:38:22.982Z' }])
    }
    if (url.pathname.endsWith('/nearby')) {
      return response([{ systemName: 'Sol', systemAddress: 10477373803, systemX: 0, systemY: 0, systemZ: 0, distance: 0, updatedAt: '2026-08-11T02:38:22.982Z' }])
    }
    return response([{ stationName: 'Galileo', systemName: 'Sol', marketId: 128016640, stationType: 'Ocellus', maxLandingPadSize: 3, distance: 0, distanceToArrival: 495.3, updatedAt: '2026-08-11T02:38:22.982Z' }])
  })
  const source = new ArdentStationSearchSource({ fetch: fetcher as typeof fetch })

  const stations = await source.findNearestStations({ minimumPadSize: 2, service: 'repair', systemName: 'Sol' })
  const markets = await source.findCommodityMarkets({ commodity: 'Gold', includeFleetCarriers: false, intent: 'buy', maxDaysAgo: 30, maxDistance: 100, minVolume: 1, systemName: 'Sol' })
  const systems = await source.findNearbySystems({ maxDistance: 25, systemName: 'Sol' })

  expect(stations[0]).toMatchObject({ stationName: 'Galileo', marketId: 128016640, maxLandingPadSize: 3 })
  expect(markets[0]).toMatchObject({ commodityName: 'gold', buyPrice: 4000, meanPrice: 50000, stock: 25 })
  expect(systems[0]).toMatchObject({ systemName: 'Sol', distanceLy: 0, position: [0, 0, 0] })
  expect(fetcher.mock.calls.map(call => new URL(String(call[0])).pathname)).toEqual([
    '/v2/system/name/Sol/nearest/repair',
    '/v2/system/name/Sol/commodity/name/Gold/nearby/exports',
    '/v2/system/name/Sol/nearby'
  ])
})

test('EDSM source normalizes shipyard and outfitting stock', async () => {
  const fetcher = vi.fn(async (input: string | URL | Request) => {
    const url = new URL(input instanceof Request ? input.url : input.toString())
    return url.pathname.endsWith('/shipyard')
      ? response({ ships: [{ id: 129036130, name: 'Type-11 Prospector' }] })
      : response({ outfitting: [{ id: 'int_cargorack_size6_class1', name: '6E Cargo Rack' }] })
  })
  const source = new EdsmStationStockSource({ fetch: fetcher as typeof fetch })

  await expect(source.getShipyard(128016640)).resolves.toEqual([{ id: 129036130, name: 'Type-11 Prospector' }])
  await expect(source.getOutfitting(128016640)).resolves.toEqual([{ id: 'int_cargorack_size6_class1', name: '6E Cargo Rack' }])
})

test('Spansh source searches and normalizes stations selling a requested hull', async () => {
  const fetcher = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => response({
    results: [{
      distance: 4.2,
      distance_to_arrival: 321.5,
      has_large_pad: true,
      market_id: 42,
      name: 'Test Exchange',
      ships: [{ name: 'Type-11 Prospector', price: 67861851, symbol: 'LakonMiner' }],
      shipyard_updated_at: '2026-08-15 17:20:23+00',
      system_name: 'Nearby',
      type: 'Orbis Starport'
    }]
  }))
  const source = new SpanshShipyardSearchSource({ fetch: fetcher as typeof fetch })

  await expect(source.findShipyards({ hullName: 'Type-11 Prospector', referencePosition: [1, 2, 3] })).resolves.toEqual([{
    distanceLy: 4.2,
    distanceToArrivalLs: 321.5,
    marketId: 42,
    maxLandingPadSize: 3,
    price: 67861851,
    shipSymbol: 'LakonMiner',
    stationName: 'Test Exchange',
    stationType: 'Orbis Starport',
    systemName: 'Nearby',
    updatedAt: '2026-08-15T17:20:23.000Z'
  }])
  expect(JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body))).toMatchObject({
    filters: { ships: { value: ['Type-11 Prospector'] } },
    reference_coords: { x: 1, y: 2, z: 3 }
  })
})

test('Spansh source searches and normalizes stations stocking a requested module', async () => {
  const fetcher = vi.fn(async () => response({
    results: [{
      distance: 4.2,
      distance_to_arrival: 321.5,
      has_large_pad: true,
      market_id: 42,
      modules: [{ category: 'standard', class: 6, ed_symbol: 'int_powerplant_size6_class5', name: 'Power Plant', price: 16257880, rating: 'A' }],
      name: 'Test Exchange',
      outfitting_updated_at: '2026-08-15 17:20:23+00',
      system_name: 'Nearby',
      type: 'Orbis Starport'
    }]
  }))
  const source = new SpanshOutfittingSearchSource({ fetch: fetcher as typeof fetch })

  await expect(source.findOutfitting({
    maxDistanceLy: 100,
    minimumPadSize: 3,
    moduleClass: 6,
    moduleName: 'Power Plant',
    moduleRating: 'A',
    referencePosition: [1, 2, 3]
  })).resolves.toEqual([{
    category: 'standard', distanceLy: 4.2, distanceToArrivalLs: 321.5, marketId: 42,
    maxLandingPadSize: 3, moduleClass: 6, moduleName: 'Power Plant', moduleRating: 'A',
    moduleSymbol: 'int_powerplant_size6_class5', price: 16257880, ship: null,
    stationName: 'Test Exchange', stationType: 'Orbis Starport', systemName: 'Nearby',
    updatedAt: '2026-08-15T17:20:23.000Z'
  }])
  expect(JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body))).toMatchObject({
    filters: {
      distance: { max: '100', min: 0 },
      has_large_pad: { value: true },
      modules: { class: ['6'], name: ['Power Plant'], rating: ['A'] }
    },
    reference_coords: { x: 1, y: 2, z: 3 }
  })
})

test('station and market query resolves current location, formats trade direction, and caches providers', async () => {
  const runtime = new InMemoryRuntimeStateStore()
  const state = createEmptyRuntimeState()
  runtime.replace({
    ...state,
    system: { ...state.system, name: 'Sol' },
    location: {
      state: 'docked',
      place: {
        kind: 'station', name: 'Galileo', type: 'Ocellus', marketId: 128016640,
        faction: null, government: null, primaryEconomy: null, economies: [], services: ['shipyard', 'outfitting']
      }
    }
  })
  const search: StationSearchSource = {
    findCommodityMarkets: vi.fn(async () => [market()]),
    findNearestStations: vi.fn(async () => [nearbyStation()]),
    findNearbySystems: vi.fn(async () => [nearbySystem()])
  }
  const stock: StationStockSource = {
    getOutfitting: vi.fn(async () => [{ id: 'rack', name: '6E Cargo Rack' }, { id: 'laser', name: '2D Mining Laser' }]),
    getShipyard: vi.fn(async () => [{ id: 1, name: 'Type-11 Prospector' }])
  }
  const shipyards: ShipyardSearchSource = {
    findShipyards: vi.fn(async () => [{
      distanceLy: 4.2, distanceToArrivalLs: 321.5, marketId: 42, maxLandingPadSize: 3,
      price: 67861851, shipSymbol: 'LakonMiner', stationName: 'Test Exchange', stationType: 'Orbis',
      systemName: 'Nearby', updatedAt: '2026-08-15T17:20:23.000Z'
    }])
  }
  const outfittingMarkets: OutfittingSearchSource = {
    findOutfitting: vi.fn(async () => [{
      category: 'standard', distanceLy: 4.2, distanceToArrivalLs: 321.5, marketId: 42,
      maxLandingPadSize: 3, moduleClass: 6, moduleName: 'Power Plant', moduleRating: 'A',
      moduleSymbol: 'int_powerplant_size6_class5', price: 16257880, ship: null,
      stationName: 'Test Exchange', stationType: 'Orbis', systemName: 'Nearby',
      updatedAt: '2026-08-11T10:00:00.000Z'
    }])
  }
  const service = new DefaultStationMarketQuery(search, stock, shipyards, outfittingMarkets, cartography(), runtime, new MemoryProviderCache(), () => new Date('2026-08-11T12:00:00Z'))

  const firstTrade = await service.findBestTrade({ commodity: 'Gold', intent: 'buy' })
  await service.findBestTrade({ commodity: 'Gold', intent: 'buy' })
  const details = await service.getDetails({})
  const shipyard = await service.listShipyardStock({})
  const outfitting = await service.searchOutfitting({ query: 'cargo' })
  const nearest = await service.findNearest({ service: 'repair' })
  const galaxyMarkets = await service.searchCommodityMarkets({ commodity: 'Gold', includeFleetCarriers: false, intent: 'sell', maxDaysAgo: 30, maxDistance: 100, minVolume: 1, systemName: 'Sol' })
  const galaxyStations = await service.searchNearestStations({ minimumPadSize: 2, service: 'repair', systemName: 'Sol' }, 20, 'medium')
  const galaxySystems = await service.searchNearbySystems({ maxDistance: 25, systemName: 'Sol' })
  const galaxyShipyards = await service.searchShipyards('Type-11 Prospector', 'Sol')
  const galaxyOutfitting = await service.searchOutfittingMarkets({ maxDaysAgo: 30, maxDistanceLy: 100, minimumPadSize: 3, query: '6A Power Plant', systemName: 'Sol' })
  const toolOutfitting = await service.findOutfitting({ query: '6A Power Plant', systemName: 'Sol' })

  expect(search.findCommodityMarkets).toHaveBeenCalledTimes(2)
  expect(search.findNearestStations).toHaveBeenCalledTimes(2)
  expect(search.findNearbySystems).toHaveBeenCalledTimes(1)
  expect(firstTrade.structuredContent).toMatchObject({ cache: 'refreshed', intent: 'buy', originSystem: 'Sol' })
  expect(firstTrade.content[0]).toMatchObject({ text: expect.stringContaining('91.5% below average') })
  expect(details.structuredContent).toMatchObject({ station: { name: 'Galileo' }, systemName: 'Sol' })
  expect(shipyard.structuredContent).toMatchObject({ ships: [{ name: 'Type-11 Prospector' }] })
  expect(outfitting.structuredContent).toMatchObject({ modules: [{ name: '6E Cargo Rack' }] })
  expect(nearest.structuredContent).toMatchObject({ service: 'repair', stations: [{ stationName: 'Galileo' }] })
  expect(galaxyMarkets).toMatchObject({ cache: 'refreshed', commodity: 'Gold', intent: 'sell', markets: [{ stationName: 'Galileo' }] })
  expect(galaxyStations).toMatchObject({ cache: 'refreshed', minimumPadSize: 'medium', service: 'repair', stations: [{ stationName: 'Galileo' }] })
  expect(galaxySystems).toMatchObject({ cache: 'refreshed', maxDistanceLy: 25, systems: [{ systemName: 'Alpha Centauri' }] })
  expect(galaxyShipyards).toMatchObject({ cache: 'refreshed', hullName: 'Type-11 Prospector', shipyards: [{ stationName: 'Test Exchange' }] })
  expect(galaxyOutfitting).toMatchObject({ cache: 'refreshed', moduleClass: 6, moduleName: 'Power Plant', moduleRating: 'A', matches: [{ stationName: 'Test Exchange' }] })
  expect(toolOutfitting.structuredContent).toMatchObject({ moduleClass: 6, moduleName: 'Power Plant', moduleRating: 'A', matches: [{ stationName: 'Test Exchange' }] })
})

test('provider response cache persists arbitrary normalized documents in SQLite', () => {
  const database = new SqliteDatabase(':memory:')
  database.initialize()
  try {
    database.putProviderResponse('market', 'sol:gold', '2026-08-11T12:00:00.000Z', [{ station: 'Galileo' }])
    expect(database.getProviderResponse('market', 'sol:gold')).toEqual({
      fetchedAt: '2026-08-11T12:00:00.000Z',
      value: [{ station: 'Galileo' }]
    })
  } finally {
    database.close()
  }
})

class MemoryProviderCache implements ProviderResponseCache {
  private readonly entries = new Map<string, ProviderCacheEntry>()
  public getProviderResponse (namespace: string, key: string) { return this.entries.get(`${namespace}:${key}`) ?? null }
  public putProviderResponse (namespace: string, key: string, fetchedAt: string, value: unknown) {
    this.entries.set(`${namespace}:${key}`, { fetchedAt, value })
  }
}

function cartography (): SystemCartography {
  const system = fixtureSystem()
  return { getSystem: async () => ({ cache: 'fresh', system }) }
}

function fixtureSystem (): CartographicSystem {
  return {
    schemaVersion: 1,
    name: 'Sol', address: 10477373803, position: [0, 0, 0], permitRequired: null, permitName: null,
    information: { allegiance: 'Federation', government: 'Democracy', security: 'High', state: null, primaryEconomy: 'Service', secondaryEconomy: null, population: 23000000000, controllingFaction: 'Mother Gaia' },
    primaryStar: null, bodies: [], scanProgress: { knownBodies: 0, reportedBodies: null, percent: null }, localSystem: null,
    stations: [{
      id: 1, marketId: 128016640, name: 'Galileo', type: 'Ocellus', distanceToArrival: 495.3,
      allegiance: 'Federation', government: 'Democracy', economy: 'Refinery', secondEconomy: null,
      controllingFaction: 'Mother Gaia', services: ['Repair'], facilities: { market: true, shipyard: true, outfitting: true }, raw: {}
    }],
    source: { provider: 'edsm', fetchedAt: '2026-08-11T12:00:00.000Z' },
    raw: { system: {}, bodies: {}, stations: {} }
  }
}

function market (): CommodityMarket {
  return {
    commodityName: 'gold', marketId: 128016640, stationName: 'Galileo', stationType: 'Ocellus', systemName: 'Sol',
    buyPrice: 4000, sellPrice: 3900, meanPrice: 47000, stock: 25, demand: 3, distanceLy: 0,
    distanceToArrivalLs: 495.3, maxLandingPadSize: 3, updatedAt: '2026-08-11T02:38:22.982Z'
  }
}

function nearbyStation (): NearbyStation {
  return {
    stationName: 'Galileo', systemName: 'Sol', marketId: 128016640, stationType: 'Ocellus', maxLandingPadSize: 3,
    distanceLy: 0, distanceToArrivalLs: 495.3, allegiance: 'Federation', government: 'Democracy',
    controllingFaction: 'Mother Gaia', primaryEconomy: 'Refinery', secondaryEconomy: null, updatedAt: '2026-08-11T02:38:22.982Z'
  }
}

function nearbySystem (): NearbySystem {
  return {
    distanceLy: 4.37,
    position: [3.03125, -0.09375, 3.15625],
    systemAddress: 1178707802194,
    systemName: 'Alpha Centauri',
    updatedAt: '2026-08-11T02:38:22.982Z'
  }
}

function response (value: unknown): Response {
  return new Response(JSON.stringify(value), { status: 200, headers: { 'content-type': 'application/json' } })
}
