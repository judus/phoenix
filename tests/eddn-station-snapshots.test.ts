import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { EliteStationSnapshotReader } from '@phoenix/elite'
import { EddnMessageBuilder } from '../apps/server/src/domain/eddn-message-builder.js'
import { EddnSchemaValidator } from '../apps/server/src/infrastructure/eddn-schema-validator.js'

const timestamp = '2026-10-04T18:00:00Z'
const dock = { event: 'Location', timestamp, StarSystem: 'Sol', SystemAddress: 123, StarPos: [0, 0, 0], Docked: true, MarketID: 42, StationName: 'Galileo' }
const validator = new EddnSchemaValidator('resources/eddn')
function builder () {
  const value = new EddnMessageBuilder('0.1.2')
  value.observe({ event: 'Fileheader', timestamp, gameversion: '4.0', build: 'r1' })
  value.observe({ event: 'LoadGame', timestamp, Commander: 'Test', Horizons: true, Odyssey: true })
  value.observe(dock)
  return value
}

test('snapshot reader limits size and event paths and refuses partial files', () => {
  const directory = mkdtempSync(join(tmpdir(), 'phoenix-eddn-stock-'))
  const reader = new EliteStationSnapshotReader(directory)
  const event = { event: 'Market', timestamp, MarketID: 42 }
  try {
    expect(reader.read(event)).toBeUndefined()
    writeFileSync(join(directory, 'Market.json'), '{"Items":[')
    expect(reader.read(event)).toBeUndefined()
    writeFileSync(join(directory, 'Market.json'), ' '.repeat(2 * 1024 * 1024 + 1))
    expect(reader.read(event)).toBeUndefined()
    writeFileSync(join(directory, 'Market.json'), JSON.stringify({ ...dock, ...event, Items: [] }))
    expect(reader.read(event)).toMatchObject({ event: 'Market', MarketID: 42 })
    expect(reader.read({ ...event, event: '../Market' })).toBeUndefined()
    expect(new EliteStationSnapshotReader(null).read(event)).toBeUndefined()
  } finally { rmSync(directory, { recursive: true, force: true }) }
})

test('market fields are renamed and private/localised, illegal and non-marketable items excluded', () => {
  const event = { event: 'Market', timestamp, MarketID: 42 }
  const commodity = { id: 1, Name: '$gold_name;', Name_Localised: 'Gold', Category: '$Metals_name;', MeanPrice: 100,
    BuyPrice: 101, SellPrice: 99, Stock: 12, StockBracket: 2, Demand: 0, DemandBracket: 0,
    Producer: true, Rare: false, Private: 'secret' }
  const message = builder().stock(event, { ...dock, ...event, Items: [commodity,
    { ...commodity, Category: '$NonMarketable_name;' }, { ...commodity, legality: 'Illegal' }] })!
  expect(validator.valid(message)).toBe(true)
  expect(message.message).toEqual({ timestamp, systemName: 'Sol', stationName: 'Galileo', marketId: 42, horizons: true, odyssey: true,
    commodities: [{ name: 'gold', meanPrice: 100, buyPrice: 101, sellPrice: 99, stock: 12, stockBracket: 2, demand: 0, demandBracket: 0 }] })
  const invalid = builder().stock(event, { ...dock, ...event, Items: [{ ...commodity, BuyPrice: undefined }] })!
  expect(validator.valid(invalid)).toBe(false)
})

test('outfitting excludes cosmetics, personal unlocks and approach suite, and deduplicates names', () => {
  const event = { event: 'Outfitting', timestamp, MarketID: 42 }
  const snapshot = { ...dock, ...event, Items: [
    { Name: 'int_engine_size3_class5' }, { Name: 'int_engine_size3_class5' },
    { Name: 'hpt_beamlaser_fixed_small', sku: 'PERSONAL_UNLOCK' },
    { Name: 'bobblehead_test' }, { Name: 'int_planetapproachsuite' },
    { Name: 'int_buggybay_size2_class1', sku: 'ELITE_HORIZONS_V_PLANETARY_LANDINGS' }
  ] }
  const message = builder().stock(event, snapshot)!
  expect(validator.valid(message)).toBe(true)
  expect(message.message.modules).toEqual(['int_engine_size3_class5', 'int_buggybay_size2_class1'])
  expect(validator.valid(builder().stock(event, { ...snapshot, Items: [] })!)).toBe(false)
})

test.each(['PriceList', 'Pricelist'])('shipyard reads journal %s and sends only ship symbols', field => {
  const event = { event: 'Shipyard', timestamp, MarketID: 42 }
  const message = builder().stock(event, { ...dock, ...event, [field]: [
    { ShipType: 'sidewinder', ShipPrice: 100, id: 7 }, { ShipType: 'sidewinder' }, { ShipType: 'adder' }
  ] })!
  expect(validator.valid(message)).toBe(true)
  expect(message.message.ships).toEqual(['sidewinder', 'adder'])
})
