import { expect, test, vi } from 'vitest'
import { JsonGameCatalogue, matchCatalogueSuggestions } from '@phoenix/elite'
import { CatalogueSuggestionService } from '../apps/server/src/application/catalogue-suggestion-service.js'
import { SpanshShipyardSearchSource } from '../apps/server/src/infrastructure/spansh-shipyard-search-source.js'
import { SpanshSearchClient } from '../apps/server/src/infrastructure/spansh-search-client.js'

const catalogue = new JsonGameCatalogue('tests/fixtures/catalogue/ships.json', 'tests/fixtures/catalogue/modules.json', 'tests/fixtures/catalogue/commodities.json')

test('commodity listing is unique, defensive, and uses Elite names and symbols', async () => {
  const items = catalogue.listCommodities()
  expect(new Set(items.map(item => item.symbol)).size).toBe(items.length)
  items[0]!.displayName = 'Changed'
  expect(catalogue.listCommodities()[0]!.displayName).not.toBe('Changed')
  const service = new CatalogueSuggestionService(catalogue, { shipNames: vi.fn() }, { moduleNames: vi.fn() })
  expect(await service.suggest('commodity', 'catal')).toContainEqual({ label: 'Advanced Catalysers', value: 'AdvancedCatalysers', source: 'Elite' })
})

test('only provider ship/module names are offered; arbitrary input is never silently resolved', async () => {
  const ships = { shipNames: vi.fn().mockResolvedValue(['Type-11 Prospector']) }
  const modules = { moduleNames: vi.fn().mockResolvedValue(['Guardian FSD Booster', 'Point Defence']) }
  const service = new CatalogueSuggestionService(catalogue, ships, modules)
  expect(await service.suggest('ship', 'prospector')).toEqual([{ label: 'Type-11 Prospector', value: 'Type-11 Prospector', source: 'Spansh' }])
  expect(await service.suggest('ship', 'anaconda')).toEqual([])
  expect(await service.suggest('module', '5h guardian booster')).toEqual([{ label: '5H Guardian FSD Booster', value: '5H Guardian FSD Booster', source: 'Spansh' }])
  expect(await service.suggest('module', 'unknown')).toEqual([])
  ships.shipNames.mockRejectedValue(new Error('offline'))
  await expect(service.suggest('ship', 'type')).rejects.toThrow('offline')
})

test('matching ranks exact names first, retains ambiguous choices, deduplicates and bounds results', () => {
  const entries = ['Gold', 'Gold', 'Gold Thing', ...Array.from({ length: 15 }, (_, i) => `Item Gold ${i}`)]
    .map(label => ({ label, value: label, source: 'Elite' as const }))
  const result = matchCatalogueSuggestions(entries, 'commodity', 'gold')
  expect(result).toHaveLength(12)
  expect(result[0]!.label).toBe('Gold')
  expect(result[1]!.label).toBe('Gold Thing')
  expect(new Set(result.map(item => item.value)).size).toBe(12)
  expect(matchCatalogueSuggestions(entries, 'commodity', 'g')).toEqual([])
  expect(matchCatalogueSuggestions([{ label: 'Beam Laser', value: 'Beam Laser', source: 'Spansh' }], 'module', 'beam turret')).toEqual([])
})

test('ship vocabulary requests are shared, expire, and retry after errors', async () => {
  vi.useFakeTimers()
  try {
    const findFieldValues = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(['Cobra Mk III'])
    const source = new SpanshShipyardSearchSource({ findFieldValues, search: async () => [] })
    await expect(source.shipNames()).rejects.toThrow('offline')
    expect(await Promise.all([source.shipNames(), source.shipNames()])).toEqual([['Cobra Mk III'], ['Cobra Mk III']])
    expect(findFieldValues).toHaveBeenCalledWith('stations', 'ships', '')
    expect(findFieldValues).toHaveBeenCalledTimes(2)
    vi.advanceTimersByTime(86_400_001)
    await source.shipNames()
    expect(findFieldValues).toHaveBeenCalledTimes(3)
  } finally { vi.useRealTimers() }
})

test('Spansh ship vocabulary uses composite name values, preserving provider spelling', async () => {
  const source = new SpanshShipyardSearchSource(new SpanshSearchClient({ fetch: vi.fn(async () => new Response(JSON.stringify({ values: { name: ['Cobra MkIII', 'Cobra MkIII'], price: [] } }))) }))
  const names = await source.shipNames()
  expect(names).toEqual(['Cobra MkIII'])
  expect(matchCatalogueSuggestions(names.map(name => ({ label: name, value: name, source: 'Spansh' })), 'ship', 'cobra mk iii'))
    .toEqual([{ label: 'Cobra MkIII', value: 'Cobra MkIII', source: 'Spansh' }])
})
