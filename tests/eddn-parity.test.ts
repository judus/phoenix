import { DatabaseSync } from 'node:sqlite'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { EliteJournalSnapshotReader, type EliteJournalEvent } from '@phoenix/elite'
import { EddnContributionService } from '../apps/server/src/application/eddn-contribution-service.js'
import { EddnMessageBuilder } from '../apps/server/src/domain/eddn-message-builder.js'
import { EDDN_MAX_MESSAGE_BYTES, EDDN_SCHEMA_VERSIONS } from '../apps/server/src/domain/eddn.js'
import { EddnSchemaValidator } from '../apps/server/src/infrastructure/eddn-schema-validator.js'
import { SqliteEddnOutbox } from '../apps/server/src/infrastructure/sqlite-eddn-outbox.js'
import { InMemorySystemSettingsRepository } from '../apps/server/src/infrastructure/json-system-configuration.js'

const timestamp = '2026-10-04T18:00:00Z'
const now = Date.parse(timestamp)
const location = { timestamp, event: 'Location', StarSystem: 'Sol', SystemAddress: 123, StarPos: [0, 0, 0] }
const header = { timestamp, event: 'Fileheader', gameversion: '4.0', build: 'r1 ' }
const load = { timestamp, event: 'LoadGame', Commander: 'Synthetic', Horizons: true, Odyssey: true }
const validator = new EddnSchemaValidator('resources/eddn')
const cleanup: Array<() => Promise<void>> = []
afterEach(async () => { for (const close of cleanup.splice(0)) await close() })
function builder () {
  const value = new EddnMessageBuilder('0.1.3')
  for (const event of [header, load, location]) value.observe(event)
  return value
}

// Hand-authored protocol fixtures, not real player journals or copied EDMC implementation.
const cases: Array<{ event: string, schema: string, data: Record<string, unknown>, name?: string }> = [
  { event: 'CarrierJump', schema: 'journal', data: { ...location, Docked: true, StationName: 'Test Carrier', MarketID: 42 } },
  { event: 'SAASignalsFound', schema: 'journal', data: { BodyID: 1, BodyName: 'Sol 1', Signals: [{ Type: 'Biological', Count: 2 }], Genuses: [{ Genus: '$Codex_Ent_Stratum_Genus_Name;' }] } },
  { event: 'FSSDiscoveryScan', schema: 'fssdiscoveryscan', name: 'SystemName', data: { SystemName: 'Sol', BodyCount: 8, NonBodyCount: 2, Progress: 0.2 } },
  { event: 'NavBeaconScan', schema: 'navbeaconscan', data: { NumBodies: 8 } },
  { event: 'FSSAllBodiesFound', schema: 'fssallbodiesfound', name: 'SystemName', data: { SystemName: 'Sol', Count: 8 } },
  { event: 'FSSBodySignals', schema: 'fssbodysignals', data: { BodyID: 1, BodyName: 'Sol 1', Signals: [{ Type: 'Biological', Count: 2, Type_Localised: 'secret' }] } },
  { event: 'ScanBaryCentre', schema: 'scanbarycentre', data: { BodyID: 1, SemiMajorAxis: 1, Eccentricity: 0.1, OrbitalInclination: 2, Periapsis: 3, OrbitalPeriod: 4, AscendingNode: 5, MeanAnomaly: 6 } },
  { event: 'ApproachSettlement', schema: 'approachsettlement', data: { Name: 'Test Site', BodyID: 1, BodyName: 'Sol 1', Latitude: 12, Longitude: -20, MarketID: 42,
    StationFaction: { Name: 'Public Faction', MyReputation: 99 }, StationEconomies: [{ Name: 'Industrial', Proportion: 1, Name_Localised: 'secret' }] } },
  { event: 'CodexEntry', schema: 'codexentry', name: 'System', data: { System: 'Sol', EntryID: 1234, Name: '$Codex_Test;', Category: 'Biology', SubCategory: 'Organic', Region: 'Test Region', Latitude: 12, Longitude: 13,
    Traits: ['Trait'], VoucherAmount: 2500, IsNewEntry: true, NewTraitsDiscovered: ['private'] } },
  { event: 'DockingDenied', schema: 'dockingdenied', data: { MarketID: 42, StationName: 'Test Station', StationType: 'FleetCarrier', Reason: 'RestrictedAccess' } },
  { event: 'DockingGranted', schema: 'dockinggranted', data: { MarketID: 42, StationName: 'Test Station', StationType: 'Coriolis', LandingPad: 4 } }
]

describe('expanded EDDN protocol mappings', () => {
  test.each(cases)('$event uses its exact schema and public fields only', item => {
    const event = { timestamp, SystemAddress: 123, ...item.data, event: item.event,
      Commander: 'private', FID: 'private', UnknownFutureField: 'private', Name_Localised: 'private' }
    const value = builder()
    value.observe(event)
    const message = value.journal(event)!
    expect(message.$schemaRef).toBe(`https://eddn.edcd.io/schemas/${item.schema}/${EDDN_SCHEMA_VERSIONS[item.schema as keyof typeof EDDN_SCHEMA_VERSIONS]}/test`)
    expect(validator.valid(message)).toBe(true)
    expect(JSON.stringify(message.message)).not.toMatch(/private|secret|_Localised|MyReputation/)
    for (const field of ['Progress', 'IsNewEntry', 'NewTraitsDiscovered']) expect(message.message).not.toHaveProperty(field)
    if (item.name) {
      expect(message.message[item.name]).toBe('Sol')
      expect(message.message).not.toHaveProperty('StarSystem')
    }
    if (item.event.startsWith('Docking')) expect(message.message).not.toHaveProperty('SystemAddress')
    if (item.event === 'ApproachSettlement') expect(message.message).toMatchObject({ Latitude: 12, Longitude: -20, MarketID: 42 })
    expect(event.UnknownFutureField).toBe('private')
  })

  test('rejects system name/address disagreements, incomplete settlements and body signals', () => {
    const value = builder()
    for (const data of [{ SystemAddress: 456 }, { SystemName: 'Other' }]) {
      expect(value.journal({ timestamp, event: 'FSSAllBodiesFound', SystemAddress: 123, SystemName: 'Sol', Count: 2, ...data })).toBeUndefined()
    }
    expect(validator.valid(value.journal({ timestamp, event: 'ApproachSettlement', SystemAddress: 123, Name: 'Site' }))).toBe(false)
    expect(validator.valid(value.journal({ timestamp, event: 'FSSBodySignals', SystemAddress: 123, BodyID: 1, Signals: [{ Count: 1 }] }))).toBe(false)
  })

  test('Codex body inference requires Status and journal agreement; direct BodyID is retained', () => {
    const value = builder()
    const event = { timestamp, event: 'CodexEntry', System: 'Sol', SystemAddress: 123, EntryID: 1 }
    value.observe({ timestamp, event: 'ApproachBody', SystemAddress: 123, Body: 'Sol 1', BodyID: 1 })
    expect(value.journal(event)?.message).not.toHaveProperty('BodyID')
    value.observeStatus({ timestamp, bodyName: 'Sol 1' })
    expect(value.journal(event)?.message).toMatchObject({ BodyID: 1, BodyName: 'Sol 1' })
    value.observe({ timestamp, event: 'SupercruiseEntry' })
    expect(value.journal(event)?.message.BodyID).toBe(1)
    value.observeStatus({ timestamp, bodyName: 'Sol 2' })
    expect(value.journal(event)?.message).toMatchObject({ BodyName: 'Sol 2' })
    expect(value.journal(event)?.message).not.toHaveProperty('BodyID')
    expect(value.journal({ ...event, BodyID: 2 })?.message.BodyID).toBe(2)
    value.observeStatus({ timestamp, bodyName: null })
    expect(value.journal(event)?.message).not.toHaveProperty('BodyName')
    value.observe({ timestamp, event: 'LeaveBody' })
    expect(value.journal(event)?.message).not.toHaveProperty('BodyID')
    value.observe({ ...location, event: 'FSDJump', timestamp: '2026-10-04T18:01:00Z' })
    value.observeStatus({ timestamp, bodyName: 'Sol 1' })
    expect(value.journal(event)?.message).not.toHaveProperty('BodyName')
  })

  test('docking on a planet includes known body context but never personal surface coordinates', () => {
    const value = builder()
    value.observe({ timestamp, event: 'ApproachBody', SystemAddress: 123, Body: 'Sol 1', BodyID: 1 })
    const message = value.journal({ ...location, event: 'Docked', MarketID: 42, StationName: 'Site', Latitude: 3, Longitude: 4 })!
    expect(message.message).toMatchObject({ Body: 'Sol 1', BodyType: 'Planet' })
    expect(message.message).not.toHaveProperty('Latitude')
    value.observe({ timestamp, event: 'ApproachBody', SystemAddress: 999, Body: 'Other 1', BodyID: 1 })
    expect(value.journal({ ...location, event: 'Docked', MarketID: 42, StationName: 'Site' })?.message).not.toHaveProperty('Body')
    expect(value.journal({ ...location, event: 'Scan', BodyName: 'Sol 1', TerraformState: null })?.message.TerraformState).toBeNull()
  })

  test('route and carrier snapshots require exact triggering identity and filter nested fields', () => {
    const value = builder()
    const routeEvent = { timestamp, event: 'NavRoute' }
    const route = { ...routeEvent, Route: [{ StarSystem: 'Other', SystemAddress: 456, StarPos: [1, 2, 3], StarClass: 'K', Private: true }] }
    const message = value.snapshot(routeEvent, route)!
    expect(validator.valid(message)).toBe(true)
    expect(JSON.stringify(message)).not.toContain('Private')
    expect(value.snapshot(routeEvent, { ...route, timestamp: '2026-10-03T18:00:00Z' })).toBeUndefined()
    expect(validator.valid(value.snapshot(routeEvent, { ...route, Route: [{ ...route.Route[0], StarPos: [1, 2] }] }))).toBe(false)
    const event = { timestamp, event: 'FCMaterials', MarketID: 42, CarrierID: 'ABC-123', CarrierName: 'Test Carrier' }
    const stock = { ...event, Items: [{ id: 1, Name: '$memorychip_name;', Price: 500, Stock: 5, Demand: 0, Name_Localised: 'private', Unknown: 'private' }] }
    expect(validator.valid(value.snapshot(event, stock))).toBe(true)
    expect(JSON.stringify(value.snapshot(event, stock))).not.toContain('private')
    expect(value.snapshot(event, { ...stock, CarrierID: 'WRONG' })).toBeUndefined()
    expect(value.snapshot(event, { ...stock, MarketID: 43 })).toBeUndefined()
    expect(validator.valid(value.snapshot(event, { ...stock, Items: [] }))).toBe(true)
  })

  test('long routes larger than the former 128 KiB limit remain valid without truncation', () => {
    const value = builder()
    const event = { timestamp, event: 'NavRoute' }
    const Route = Array.from({ length: 2500 }, (_, i) => ({ StarSystem: `Synthetic ${i}`, SystemAddress: i, StarPos: [i, i, i], StarClass: 'K' }))
    const message = value.snapshot(event, { ...event, Route })!
    expect(Buffer.byteLength(JSON.stringify(message))).toBeGreaterThan(128 * 1024)
    expect(validator.valid(message)).toBe(true)
    expect(message.message.Route).toHaveLength(2500)
  })

  test('stock snapshots supply Horizons independently of session flags and preserve carrier access', () => {
    const value = builder()
    value.observe({ ...location, Docked: true, MarketID: 42, StationName: 'Test' })
    const event = { timestamp, event: 'Outfitting', MarketID: 42 }
    const stock = { ...event, StarSystem: 'Sol', StationName: 'Test', Horizons: false, Items: [{ Name: 'int_engine_size3_class5' }] }
    expect(value.snapshot(event, stock)?.message).toMatchObject({ horizons: false, odyssey: true })
    expect(value.snapshot(event, { ...stock, Horizons: undefined })?.message).not.toHaveProperty('horizons')
    const market = { ...event, event: 'Market' }
    const message = value.snapshot(market, { ...stock, ...market, Items: [], StationType: 'FleetCarrier', CarrierDockingAccess: 'All' })!
    expect(validator.valid(message)).toBe(true)
    expect(message.message).toMatchObject({ stationType: 'FleetCarrier', carrierDockingAccess: 'All' })
  })

  test('snapshot reader covers only the five journal-triggered files', () => {
    const directory = mkdtempSync(join(tmpdir(), 'phoenix-eddn-snapshots-'))
    try {
      const reader = new EliteJournalSnapshotReader(directory)
      for (const event of ['NavRoute', 'FCMaterials']) {
        writeFileSync(join(directory, `${event}.json`), JSON.stringify({ event, timestamp }))
        expect(reader.read({ event, timestamp })).toEqual({ event, timestamp })
      }
      expect(reader.read({ timestamp, event: 'Status' })).toBeUndefined()
    } finally { rmSync(directory, { recursive: true, force: true }) }
  })
})

function serviceFixture () {
  const connection = new DatabaseSync(':memory:')
  const outbox = new SqliteEddnOutbox(connection)
  const send = vi.fn().mockResolvedValue({ status: 200 })
  const readSnapshot = vi.fn((_event: EliteJournalEvent): Record<string, unknown> | undefined => undefined)
  const service = new EddnContributionService({ mode: 'test', version: '0.1.3', outbox,
    settings: new InMemorySystemSettingsRepository(), transport: { send }, readSnapshot,
    valid: message => validator.valid(message), now: () => now })
  service.start()
  let id = 0
  const observe = (event: EliteJournalEvent, replayed = false) => service.observe(event, { id: String(++id), replayed })
  for (const event of [header, load, location]) observe(event, true)
  cleanup.push(async () => { await service.stop(); connection.close() })
  const messages = () => (connection.prepare('SELECT document FROM eddn_outbox WHERE ready = 1 ORDER BY rowid').all() as Array<{ document: string }>).map(row => JSON.parse(row.document))
  return { service, outbox, send, readSnapshot, observe, messages }
}
const signal = { timestamp, event: 'FSSSignalDiscovered', SystemAddress: 123, SignalName: 'Public Signal', TimeRemaining: 77, SignalName_Localised: 'private' }

describe('expanded EDDN ingestion sequences', () => {
  test.each(cases)('$event travels through the real service/outbox/validator path', item => {
    const f = serviceFixture()
    f.observe({ timestamp, SystemAddress: 123, ...item.data, event: item.event })
    expect(f.messages()).toHaveLength(1)
    expect(f.messages()[0].message.event).toBe(item.event)
  })

  test('batches contiguous signals, including Odyssey pre-arrival order; filters private/mismatched signals', () => {
    const f = serviceFixture()
    f.observe({ timestamp, event: 'StartJump', JumpType: 'Hyperspace' })
    f.observe(signal)
    f.observe({ ...signal, SignalName: 'Second', timestamp: '2026-10-04T18:00:01Z' })
    f.observe({ ...signal, USSType: '$USS_Type_MissionTarget;' })
    f.observe({ ...signal, SystemAddress: 456 })
    expect(f.messages()).toHaveLength(0)
    f.observe({ ...location, event: 'FSDJump' })
    expect(f.messages()).toHaveLength(2)
    expect(f.messages()[0].message).toMatchObject({ timestamp, StarSystem: 'Sol', signals: [
      { timestamp, SignalName: 'Public Signal' }, { timestamp: '2026-10-04T18:00:01Z', SignalName: 'Second' }
    ] })
    expect(JSON.stringify(f.messages()[0])).not.toMatch(/TimeRemaining|_Localised|MissionTarget/)
    f.observe(signal)
    f.observe({ timestamp, event: 'Music', MusicTrack: 'Supercruise' })
    expect(f.messages()).toHaveLength(3)
    expect(f.messages()[2].message.signals).toHaveLength(1)
  })

  test.each(['Fileheader', 'LoadGame', 'JoinACrew', 'QuitACrew', 'MainMenu', 'disable', 'replayed'])('%s discards pending signals across privacy/session boundaries', boundary => {
    const f = serviceFixture()
    f.observe(signal)
    if (boundary === 'disable') { f.service.setEnabled(false); f.service.setEnabled(true) }
    else if (boundary === 'replayed') f.observe(signal, true)
    else f.observe(boundary === 'MainMenu' ? { timestamp, event: 'Music', MusicTrack: 'MainMenu' } : { ...load, event: boundary })
    f.observe({ timestamp, event: 'Music', MusicTrack: 'Supercruise' })
    expect(f.messages()).toHaveLength(0)
  })

  test('replayed signals never enter a live batch; mission-only and wrong-system batches do not upload', () => {
    const f = serviceFixture()
    f.observe(signal, true)
    f.observe({ ...signal, SignalName: 'Live' })
    f.observe({ timestamp, event: 'Music' })
    expect(f.messages()[0].message.signals).toEqual([{ timestamp, SignalName: 'Live' }])
    f.observe({ ...signal, USSType: '$USS_Type_MissionTarget;' })
    f.observe({ ...signal, SystemAddress: 999 })
    f.observe({ timestamp, event: 'Music' })
    expect(f.messages()).toHaveLength(1)
  })

  test('multicrew never submits another captain observations, and leaving requires fresh context', () => {
    const f = serviceFixture()
    f.observe({ timestamp, event: 'JoinACrew', Captain: 'Other' })
    f.observe(location)
    f.observe(signal)
    f.observe({ timestamp, event: 'DockingGranted', MarketID: 42, StationName: 'Test' })
    expect(f.messages()).toHaveLength(0)
    f.observe({ timestamp, event: 'QuitACrew' })
    f.observe({ timestamp, event: 'Scan', SystemAddress: 123, BodyName: 'Sol A' })
    expect(f.messages()).toHaveLength(0)
    f.observe(location)
    expect(f.messages()).toHaveLength(1)
  })

  test('oversized contiguous batch is rejected as a whole, then the next run can contribute', () => {
    const f = serviceFixture()
    f.observe({ ...signal, SignalName: 's'.repeat(EDDN_MAX_MESSAGE_BYTES) })
    f.observe(signal)
    f.observe({ timestamp, event: 'Music' })
    expect(f.messages()).toHaveLength(0)
    expect(f.service.status().error).toContain('safety limit')
    f.observe(signal)
    f.observe({ timestamp, event: 'Music' })
    expect(f.messages()).toHaveLength(1)
  })

  test('stock changes contribute, identical refreshed stock does not; disable clears suppression', () => {
    const f = serviceFixture()
    const event = { timestamp, event: 'FCMaterials', MarketID: 42, CarrierID: 'ABC-123', CarrierName: 'Test' }
    const snapshot = { ...event, Items: [{ id: 1, Name: '$test_name;', Price: 500, Stock: 5, Demand: 0 }] }
    f.readSnapshot.mockReturnValue(snapshot)
    f.observe(event)
    f.observe(event)
    expect(f.messages()).toHaveLength(1)
    f.readSnapshot.mockReturnValue({ ...snapshot, Items: [] })
    f.observe(event)
    expect(f.messages()).toHaveLength(2)
    f.service.setEnabled(false)
    f.service.setEnabled(true)
    f.observe(event)
    expect(f.messages()).toHaveLength(1)
  })

  test('service reads NavRoute snapshots, but never on bootstrap or after opt-out', () => {
    const f = serviceFixture()
    const event = { timestamp, event: 'NavRoute' }
    f.readSnapshot.mockReturnValue({ ...event, Route: [{ ...location, StarClass: 'K' }] })
    f.observe(event, true)
    expect(f.readSnapshot).not.toHaveBeenCalled()
    f.observe(event)
    expect(f.messages()).toHaveLength(1)
    expect(f.messages()[0].message.Route[0]).toEqual({ StarSystem: 'Sol', SystemAddress: 123, StarPos: [0, 0, 0], StarClass: 'K' })
    f.service.setEnabled(false)
    f.observe(event)
    expect(f.readSnapshot).toHaveBeenCalledOnce()
    expect(f.messages()).toHaveLength(0)
  })

  test('clean stop persists the last signal batch without a network call', async () => {
    const f = serviceFixture()
    f.observe(signal)
    await f.service.stop()
    expect(f.messages()).toHaveLength(1)
    expect(f.send).not.toHaveBeenCalled()
  })

  test('an open signal batch is durable but not sendable before its run closes', async () => {
    const f = serviceFixture()
    f.observe(signal)
    f.observe({ ...signal, SignalName: 'Second' })
    expect(f.outbox.status().queued).toBe(1)
    expect(f.outbox.next(now)).toBeUndefined()
    await f.service.flush()
    expect(f.send).not.toHaveBeenCalled()
    f.observe({ timestamp, event: 'Music' })
    await f.service.flush()
    expect(f.send).toHaveBeenCalledOnce()
    expect(f.send.mock.calls[0][0].message.signals).toEqual([
      { timestamp, SignalName: 'Public Signal' }, { timestamp, SignalName: 'Second' }
    ])
  })

  test('oversize rejection is durably counted once even if later uploads succeed', async () => {
    const f = serviceFixture()
    f.observe(signal)
    f.observe({ ...signal, SignalName: 's'.repeat(EDDN_MAX_MESSAGE_BYTES) })
    f.observe(signal)
    f.observe({ timestamp, event: 'Music' })
    f.observe(signal)
    f.observe({ timestamp, event: 'Music' })
    await f.service.flush()
    expect(f.send).toHaveBeenCalledOnce()
    expect(f.outbox.status()).toMatchObject({ queued: 0, losses: [{ reason: 'invalid', count: 1 }] })
  })
})
