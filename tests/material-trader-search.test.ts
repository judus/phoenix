import { expect, test, vi } from 'vitest'
import type { SpanshSearchGateway } from '../apps/server/src/infrastructure/spansh-search-client.js'
import { SpanshMaterialTraderSource } from '../apps/server/src/infrastructure/spansh-material-trader-source.js'
import { SpanshStationServiceSource } from '../apps/server/src/infrastructure/spansh-station-service-source.js'
import { MATERIAL_TRADER_SERVICES } from '@phoenix/contracts'
import { GALAXY_QUERY_CATALOGUE } from '../apps/web/src/features/galaxy/galaxy-query-catalogue.js'
import { StationsFindNearestTool } from '../apps/server/src/application/mcp-tools/stations-find-nearest-tool.js'
import type { StationQuery } from '../apps/server/src/application/mcp-tools/tool-gateways.js'

test.each(['Raw', 'Manufactured', 'Encoded'] as const)('Spansh filters %s traders explicitly and retains only suitable pads', async traderType => {
  const row = { name: 'Trader', system_name: 'Nearby', material_trader: traderType, distance: 10, large_pads: 1, market_id: 42 }
  const search = vi.fn<SpanshSearchGateway['search']>(async () => [
    row, { ...row, name: 'Closer', distance: 2, market_id: 43 },
    { ...row, material_trader: 'Other' }, { ...row, material_trader: undefined },
    { ...row, large_pads: 0, small_pads: 1 }, { ...row, distance: undefined }
  ])
  const source = new SpanshMaterialTraderSource({ search, findFieldValues: async () => [] })
  const results = await source.findMaterialTraders({ traderType, minimumPadSize: 3, referencePosition: [1, 2, 3] })
  expect(search).toHaveBeenCalledWith('stations', {
    filters: { material_trader: { value: [traderType] }, has_large_pad: { value: true } },
    referencePosition: [1, 2, 3]
  })
  expect(results.map(row => row.stationName)).toEqual(['Closer', 'Trader'])
  expect(results[0]).toMatchObject({ marketId: 43, maxLandingPadSize: 3, distanceLy: 2 })
  search.mockClear()
  await source.findMaterialTraders({ traderType, minimumPadSize: 2, referencePosition: [0, 0, 0] })
  expect(search.mock.calls.map(call => call[1].filters)).toEqual([
    { material_trader: { value: [traderType] }, has_large_pad: { value: true } },
    { material_trader: { value: [traderType] }, medium_pads: { comparison: '>=', value: 1 } }
  ])
})

test('console and Copilot expose all trader types while preserving the any identifier', () => {
  const field = GALAXY_QUERY_CATALOGUE.find(query => query.id === 'facilities')!.fields.find(field => field.id === 'service')!
  expect(field.options).toContainEqual({ value: 'material-trader', label: 'Material trader — any' })
  const tool = new StationsFindNearestTool({} as StationQuery)
  expect(field.options).toContainEqual({ value: 'vista-genomics', label: 'Vista Genomics' })
  expect(tool.definition.inputSchema.properties.service.enum).toContain('vista-genomics')
  for (const value of Object.keys(MATERIAL_TRADER_SERVICES)) {
    expect(field.options?.some(option => option.value === value)).toBe(true)
    expect(tool.definition.inputSchema.properties.service.enum).toContain(value)
  }
})

test('Vista Genomics search filters services, validates pads and orders by distance', async () => {
  const row = { name: 'Vista', system_name: 'Nearby', services: [{ name: 'Vista Genomics' }], distance: 10, large_pads: 1, market_id: 42 }
  const search = vi.fn<SpanshSearchGateway['search']>(async () => [
    row, { ...row, name: 'Closer', distance: 2, market_id: 43 },
    { ...row, services: [{ name: 'Universal Cartographics' }] },
    { ...row, services: undefined }, { ...row, distance: undefined },
    { ...row, large_pads: 0, small_pads: 1 }
  ])
  const source = new SpanshStationServiceSource({ search, findFieldValues: async () => [] })
  const result = await source.findStationsWithService({ service: 'Vista Genomics', minimumPadSize: 3, referencePosition: [1, 2, 3] })
  expect(search).toHaveBeenCalledWith('stations', {
    filters: { services: { value: ['Vista Genomics'] }, has_large_pad: { value: true } },
    referencePosition: [1, 2, 3]
  })
  expect(result.map(station => station.stationName)).toEqual(['Closer', 'Vista'])
})
