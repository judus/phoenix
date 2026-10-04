import { describe, expect, test } from 'vitest'
import { EddnMessageBuilder } from '../apps/server/src/domain/eddn-message-builder.js'
import { EddnSchemaValidator } from '../apps/server/src/infrastructure/eddn-schema-validator.js'
import { EDDN_MAX_MESSAGE_BYTES } from '../apps/server/src/domain/eddn.js'

const validator = new EddnSchemaValidator('resources/eddn')
const timestamp = '2026-10-04T18:00:00Z'
const location = { event: 'Location', timestamp, StarSystem: 'Sol', SystemAddress: 10477373803, StarPos: [0, 0, 0] }
function builder () {
  const value = new EddnMessageBuilder('0.1.2')
  value.observe({ event: 'Fileheader', timestamp, gameversion: '4.0.0.1', build: 'r1 ' })
  value.observe({ event: 'LoadGame', timestamp, Commander: 'Test', Horizons: true, Odyssey: false })
  value.observe(location)
  return value
}

describe('EDDN message boundary', () => {
  test('allowlists journal fields, including nested values, without mutating source', () => {
    const event = { ...location, Wanted: true, Latitude: 10, Commander: 'Secret', Unknown: 'private',
      Factions: [{ Name: 'Faction', MyReputation: 99, Name_Localised: 'localized', HomeSystem: true }],
      SystemFaction: { Name: 'Faction', Secret: 'private' } }
    const message = builder().journal(event)!
    expect(validator.valid(message)).toBe(true)
    expect(message.message).toEqual({ ...location, horizons: true, odyssey: false,
      Factions: [{ Name: 'Faction' }], SystemFaction: { Name: 'Faction' } })
    expect(event.Wanted).toBe(true)
    expect(message.header.gamebuild).toBe('r1 ')
    expect(message.$schemaRef.endsWith('/test')).toBe(true)
  })

  test('requires matching system address, and clears context across sessions and jumps', () => {
    const value = builder()
    const scan = { event: 'Scan', timestamp, SystemAddress: location.SystemAddress, BodyName: 'Sol A' }
    expect(validator.valid(value.journal(scan)!)).toBe(true)
    expect(value.journal({ ...scan, SystemAddress: 123 })).toBeUndefined()
    expect(value.journal({ event: 'Scan', timestamp, BodyName: 'Sol A' })).toBeUndefined()
    value.observe({ event: 'StartJump', timestamp, JumpType: 'Hyperspace' })
    expect(value.journal(scan)).toBeUndefined()
    value.observe(location)
    value.observe({ event: 'LoadGame', timestamp, Commander: 'Other' })
    expect(value.journal(scan)).toBeUndefined()
    value.observe(location)
    expect(value.journal(scan)?.message).not.toHaveProperty('odyssey')
    value.observe({ event: 'Fileheader', timestamp, gameversion: '4.0' })
    value.observe(location)
    expect(value.journal(scan)).toBeUndefined()
  })

  test('schema validation rejects wrong locations, timestamps, references and private fields', () => {
    const message = builder().journal(location)!
    expect(validator.valid({ ...message, $schemaRef: message.$schemaRef.replace('/test', '') })).toBe(false)
    for (const invalid of [{ timestamp: 'bad' }, { StarPos: [1, 2] }, { Wanted: true }]) {
      expect(validator.valid({ ...message, message: { ...message.message, ...invalid } })).toBe(false)
    }
    expect(validator.valid({ ...message, message: { ...message.message, StarSystem: 'a'.repeat(EDDN_MAX_MESSAGE_BYTES) } })).toBe(false)
  })

  test('matches stock snapshots to the observed dock, event and timestamp', () => {
    const value = builder()
    const dock = { ...location, event: 'Docked', MarketID: 42, StationName: 'Galileo' }
    value.observe(dock)
    const event = { event: 'Shipyard', timestamp, MarketID: 42 }
    const snapshot = { ...event, StarSystem: 'Sol', StationName: 'Galileo', PriceList: [{ ShipType: 'sidewinder', ShipPrice: 123 }] }
    expect(validator.valid(value.stock(event, snapshot)!)).toBe(true)
    expect(value.stock(event, { ...snapshot, MarketID: 43 })).toBeUndefined()
    expect(value.stock(event, { ...snapshot, timestamp: '2026-10-04T17:00:00Z' })).toBeUndefined()
    value.observe({ event: 'Undocked', timestamp })
    expect(value.stock(event, snapshot)).toBeUndefined()
  })
})
