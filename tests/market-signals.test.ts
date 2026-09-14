import { expect, test, vi } from 'vitest'
import { createEmptyRuntimeState, type GalaxyMarketSignalsResponse, type SavedGalaxyQuery } from '@phoenix/contracts'
import { DashboardMarketSignalService } from '../apps/server/src/application/dashboard-market-signal-service.js'
import { MarketSignalService, type MarketSignalReader } from '../apps/server/src/application/market-signal-service.js'
import type { RuntimeStateReader } from '../apps/server/src/domain/runtime-state.js'
import type { SavedGalaxyQueries } from '../apps/server/src/domain/saved-galaxy-queries.js'
import type {
  CommodityMarket,
  ProviderCacheEntry,
  ProviderResponseCache,
  StationSearchSource
} from '../apps/server/src/domain/station-market.js'

test('market signals compare current-system prices with global averages and retain the best actionable report', async () => {
  const source: StationSearchSource = {
    findCommodityMarkets: vi.fn(async () => []),
    findNearestStations: vi.fn(async () => []),
    findSystemExports: vi.fn(async () => [
      market({ buyPrice: 2_500, commodityName: 'Gold', stationName: 'Cheap Port', stock: 500 }),
      market({ buyPrice: 3_000, commodityName: 'Gold', stationName: 'Second Port', stock: 2_000 }),
      market({ buyPrice: 8_500, commodityName: 'Silver', stock: 500 }),
      market({ buyPrice: 1_000, commodityName: 'Small Port Cargo', maxLandingPadSize: 1, stock: 500 })
    ]),
    findSystemImports: vi.fn(async () => [
      market({ commodityName: 'Palladium', demand: 0, sellPrice: 30_000 }),
      market({ commodityName: 'Silver', demand: 50, sellPrice: 20_000 })
    ]),
    getCommodityReports: vi.fn(async () => [
      report('Gold', 10_000, 9_000),
      report('Silver', 10_000, 10_000),
      report('Palladium', 20_000, 15_000),
      report('Small Port Cargo', 10_000, 10_000)
    ])
  }
  const service = new MarketSignalService(source, new MemoryProviderCache(), () => new Date('2026-09-13T12:00:00.000Z'))
  const request = {
    includeFleetCarriers: false,
    maxDaysAgo: 3,
    minDeviationPercent: 20,
    minimumPadSize: 2,
    minVolume: 100,
    sides: ['buy', 'sell'] as Array<'buy' | 'sell'>,
    systemName: 'Sol'
  }

  const result = await service.searchMarketSignals(request)
  const cached = await service.searchMarketSignals(request)

  expect(result).toMatchObject({
    cache: 'refreshed',
    filters: { minimumPadSize: 'medium', sides: ['buy', 'sell'] },
    originSystem: 'Sol',
    schemaVersion: 1,
    scope: 'current-system'
  })
  expect(result.signals).toMatchObject([
    { commodityName: 'Palladium', deviationPercent: 100, price: 30_000, side: 'sell', unlimitedVolume: true, volume: 0 },
    { commodityName: 'Gold', deviationPercent: 75, price: 2_500, side: 'buy', stationName: 'Cheap Port', volume: 500 }
  ])
  expect(cached.cache).toBe('fresh')
  expect(source.findSystemExports).toHaveBeenCalledTimes(1)
  expect(source.findSystemImports).toHaveBeenCalledTimes(1)
  expect(source.getCommodityReports).toHaveBeenCalledTimes(1)
})

test('dashboard market signals use the selected saved query with the live system', async () => {
  const query: SavedGalaxyQuery = {
    createdAt: '2026-09-13T10:00:00.000Z',
    id: '00000000-0000-4000-8000-000000000001',
    name: 'Local bargains',
    parameters: {
      fleetCarriers: 'yes',
      maxDaysAgo: '5',
      minDeviationPercent: '35',
      minVolume: '250',
      origin: 'Saved origin is ignored',
      pad: 'large',
      sides: ['sell']
    },
    queryId: 'market-signals',
    schemaVersion: 2,
    updatedAt: '2026-09-13T10:00:00.000Z',
    useOnDashboard: true
  }
  const savedQueries: SavedGalaxyQueries = {
    create: vi.fn(), delete: vi.fn(), getAll: vi.fn(), update: vi.fn(),
    getDashboardQuery: vi.fn(() => query)
  }
  const response = signalResponse()
  const reader: MarketSignalReader = { searchMarketSignals: vi.fn(async () => response) }
  const state = createEmptyRuntimeState()
  const runtime: RuntimeStateReader = { getCurrent: () => ({ ...state, system: { ...state.system, name: 'Shinrarta Dezhra' } }) }
  const service = new DashboardMarketSignalService(savedQueries, reader, runtime)

  await expect(service.getDashboardMarketSignals()).resolves.toEqual({
    configuration: { id: query.id, name: query.name },
    result: response,
    schemaVersion: 1,
    state: 'ready'
  })
  expect(reader.searchMarketSignals).toHaveBeenCalledWith({
    includeFleetCarriers: true,
    maxDaysAgo: 5,
    minDeviationPercent: 35,
    minimumPadSize: 3,
    minVolume: 250,
    sides: ['sell'],
    systemName: 'Shinrarta Dezhra'
  }, 10)
})

class MemoryProviderCache implements ProviderResponseCache {
  private readonly entries = new Map<string, ProviderCacheEntry>()
  public getProviderResponse (namespace: string, key: string) { return this.entries.get(`${namespace}:${key}`) ?? null }
  public putProviderResponse (namespace: string, key: string, fetchedAt: string, value: unknown) {
    this.entries.set(`${namespace}:${key}`, { fetchedAt, value })
  }
}

function market (overrides: Partial<CommodityMarket>): CommodityMarket {
  const commodityName = overrides.commodityName ?? 'Commodity'
  return {
    buyPrice: null,
    commodityName,
    commoditySymbol: overrides.commoditySymbol ?? commodityName.replaceAll(' ', ''),
    demand: null,
    distanceLy: 0,
    distanceToArrivalLs: 320,
    marketId: 42,
    maxLandingPadSize: 3,
    meanPrice: null,
    sellPrice: null,
    stationName: 'Jameson Memorial',
    stationType: 'Orbis Starport',
    stock: null,
    systemName: 'Sol',
    updatedAt: '2026-09-13T11:00:00.000Z',
    ...overrides
  }
}

function report (commodityName: string, avgBuyPrice: number, avgSellPrice: number) {
  return { avgBuyPrice, avgSellPrice, commodityName, commoditySymbol: commodityName.replaceAll(' ', ''), maxSellPrice: avgSellPrice * 2, updatedAt: '2026-09-13T00:00:00.000Z' }
}

function signalResponse (): GalaxyMarketSignalsResponse {
  return {
    cache: 'fresh', caveat: 'Community reports may be stale.',
    filters: { includeFleetCarriers: true, maxDaysAgo: 5, minDeviationPercent: 35, minimumPadSize: 'large', minVolume: 250, sides: ['sell'] },
    originSystem: 'Shinrarta Dezhra', provenance: 'Ardent Insight community market reports', schemaVersion: 1,
    scope: 'current-system', signals: []
  }
}
