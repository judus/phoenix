import { afterEach, expect, test, vi } from 'vitest'
import { createEmptyRuntimeState, type CartographicSystem } from '@phoenix/contracts'
import { PhoenixApplication, type PhoenixApplicationOptions } from '../apps/server/src/phoenix-application.js'
import { SpanshSearchClient } from '../apps/server/src/infrastructure/spansh-search-client.js'
import type { OutfittingSearchSource, ShipyardSearchSource, StationSearchSource } from '../apps/server/src/domain/station-market.js'

afterEach(() => vi.restoreAllMocks())

async function withServer(run: (origin: string, application: PhoenixApplication) => Promise<void>, options: PhoenixApplicationOptions = {}) {
  const application = new PhoenixApplication({ databasePath: ':memory:', eliteDirectory: null,
    host: '127.0.0.1', port: 0, copilot: null, copilotRealtime: null, openAiEnvironmentKey: null,
    cartographySource: { fetchSystem: async name => system(name) }, ...options })
  try {
    const address = await application.start()
    await run(`http://${address.host}:${address.port}`, application)
  } finally { await application.stop() }
}

async function get(origin: string, path: string) {
  const response = await fetch(`${origin}/api/galaxy/${path}`)
  expect(response.status).toBe(200)
  return response.json()
}

test('application source overrides reach both suggestions and searches, with shared SQLite query caching', async () => {
  const ships: ShipyardSearchSource = { shipNames: vi.fn(async () => ['Cobra MkIII']), findShipyards: vi.fn(async () => []) }
  const modules: OutfittingSearchSource = { moduleNames: vi.fn(async () => ['Guardian FSD Booster']), findOutfitting: vi.fn(async () => []) }
  await withServer(async origin => {
    expect(await get(origin, 'suggestions?kind=ship&q=cobra')).toEqual([{ label: 'Cobra MkIII', value: 'Cobra MkIII', source: 'Spansh' }])
    expect(await get(origin, 'suggestions?kind=module&q=guardian')).toEqual([{ label: 'Guardian FSD Booster', value: 'Guardian FSD Booster', source: 'Spansh' }])
    for (const path of ['shipyards?system=Fixture&hull=Cobra%20MkIII', 'outfitting?system=Fixture&module=5H%20Guardian%20FSD%20Booster']) {
      expect(await get(origin, path)).toMatchObject({ cache: 'refreshed', originSystem: 'Fixture' })
      expect(await get(origin, path)).toMatchObject({ cache: 'fresh', originSystem: 'Fixture' })
    }
    expect(ships.findShipyards).toHaveBeenCalledExactlyOnceWith({ hullName: 'Cobra MkIII', referencePosition: [1, 2, 3] })
    expect(modules.findOutfitting).toHaveBeenCalledOnce()
    expect(modules.findOutfitting).toHaveBeenCalledWith(expect.objectContaining({ moduleClass: 5, moduleRating: 'H', referencePosition: [1, 2, 3] }))
  }, { shipyardSearchSource: ships, outfittingSearchSource: modules })
})

test('default galaxy sources share one Spansh client and retain their vocabulary caches', async () => {
  const fields = vi.spyOn(SpanshSearchClient.prototype, 'findFieldValues').mockImplementation(async (_index, field) => field === 'ships' ? ['Cobra MkIII'] : ['Guardian FSD Booster'])
  const search = vi.spyOn(SpanshSearchClient.prototype, 'search').mockResolvedValue([])
  await withServer(async origin => {
    for (let repeat = 0; repeat < 2; repeat++) {
      await get(origin, 'suggestions?kind=ship&q=cobra')
      await get(origin, 'suggestions?kind=module&q=guardian')
    }
    await get(origin, 'shipyards?system=Fixture&hull=Cobra%20MkIII')
    await get(origin, 'outfitting?system=Fixture&module=5H%20Guardian%20FSD%20Booster')
    await get(origin, 'exploration-targets?system=Fixture&maxGravityG=0.27')
    expect(fields).toHaveBeenCalledTimes(2)
    expect(search).toHaveBeenCalledTimes(3)
    const clients = [...fields.mock.contexts, ...search.mock.contexts]
    expect(new Set(clients).size).toBe(1)
    expect(search.mock.calls.map(call => call[0])).toEqual(['stations', 'stations', 'bodies'])
    for (const [, request] of search.mock.calls) expect(request.referencePosition).toEqual([1, 2, 3])
  })
})

test('station search overrides also supply market signals, retaining independent namespaces', async () => {
  const source: StationSearchSource = {
    findCommodityMarkets: vi.fn(async () => []), findSystemExports: vi.fn(async () => []),
    findSystemImports: vi.fn(async () => []), getCommodityReports: vi.fn(async () => []),
    findNearestStations: vi.fn(async () => [])
  }
  await withServer(async origin => {
    await get(origin, 'markets?system=Fixture&commodity=Gold&intent=buy')
    for (const cache of ['refreshed', 'fresh']) {
      expect(await get(origin, 'market-signals?system=Fixture')).toMatchObject({ cache, signals: [] })
    }
    expect(source.findCommodityMarkets).toHaveBeenCalledOnce()
    expect(source.findSystemExports).toHaveBeenCalledOnce()
    expect(source.findSystemImports).toHaveBeenCalledOnce()
    expect(source.getCommodityReports).toHaveBeenCalledOnce()
  }, { stationSearchSource: source })
})

test('provider failure remains an error and does not poison subsequent vocabulary requests', async () => {
  const names = vi.fn(async () => ['Cobra MkIII']).mockRejectedValueOnce(new Error('fixture offline'))
  await withServer(async origin => {
    expect((await fetch(`${origin}/api/galaxy/suggestions?kind=ship&q=cobra`)).status).toBe(500)
    expect(await get(origin, 'suggestions?kind=ship&q=cobra')).toHaveLength(1)
  }, { shipyardSearchSource: { shipNames: names, findShipyards: async () => [] } })
})

test('queries follow projected current-system changes rather than capturing startup state', async () => {
  const findStations = vi.fn(async () => [])
  await withServer(async (origin, application) => {
    for (const [name, position] of [['First', [1, 2, 3]], ['Second', [4, 5, 6]]] as const) {
      application.ingestGameEvent({ schemaVersion: 1, id: `fixture-${name}`, type: 'system.changed',
        source: 'synthetic', gameTimestamp: '2026-10-06T12:00:00.000Z', ingestedAt: '2026-10-06T12:00:00.000Z',
        payload: { ...createEmptyRuntimeState().system, name, position: [...position] } })
      expect(await get(origin, 'stations?name=Fixture&maxDistance=100')).toMatchObject({ originSystem: name, cache: 'refreshed' })
      expect(findStations).toHaveBeenLastCalledWith(expect.objectContaining({ referencePosition: [...position] }))
    }
    expect(findStations).toHaveBeenCalledTimes(2)
  }, { stationLookupSource: { findStations } })
})

function system(name: string): CartographicSystem {
  return {
    schemaVersion: 5, name, address: 42, position: [1, 2, 3], permitRequired: null, permitName: null,
    information: { allegiance: null, government: null, security: null, state: null, primaryEconomy: null,
      secondaryEconomy: null, population: null, controllingFaction: null },
    primaryStar: null, bodies: [], stations: [], scanProgress: { knownBodies: 0, reportedBodies: null, percent: null },
    localSystem: null, provenance: { edsm: { fetchedAt: new Date().toISOString() }, journal: null },
    raw: { system: {}, bodies: {}, stations: {} }
  }
}
