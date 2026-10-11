import { expect, test } from 'vitest'
import { SqliteDatabase } from '../apps/server/src/infrastructure/sqlite-database.js'
import { CarrierDataService } from '../apps/server/src/application/carrier-data-service.js'

export const carrierStats = { timestamp: '2026-10-10T10:00:00Z', event: 'CarrierStats', CarrierID: 42, CarrierType: 'Personal',
  Callsign: 'SYN-001', Name: 'Synthetic carrier', DockingAccess: 'all', AllowNotorious: false, FuelLevel: 800,
  JumpRangeCurr: 450, JumpRangeMax: 500, PendingDecommission: false,
  SpaceUsage: { TotalCapacity: 25000, Crew: 2000, Cargo: 10000, CargoSpaceReserved: 2000, ShipPacks: 1000, ModulePacks: 1000, FreeSpace: 9000 },
  Finance: { CarrierBalance: 1000000000, ReserveBalance: 100000000, AvailableBalance: 900000000, ReservePercent: 10 },
  Crew: [{ CrewRole: 'repair', CrewName: 'Synthetic crew', Activated: true, Enabled: true }] }

test('management evidence establishes carriers, foreign donations do not; snapshots and subsequent mutations survive out-of-order replay', () => {
  const database = new SqliteDatabase(':memory:'); database.initialize()
  try {
    const service = new CarrierDataService(database.carriers)
    service.ingest({ timestamp: '2026-10-10T11:00:00Z', event: 'CarrierDepositFuel', CarrierID: 99, Amount: 20, Total: 100 })
    expect(service.getCarriers()).toEqual([])
    service.ingest({ timestamp: '2026-10-10T11:00:00Z', event: 'CarrierBankTransfer', CarrierID: 42, Deposit: 20, CarrierBalance: 1000000020 })
    service.ingest({ timestamp: '2026-10-10T10:30:00Z', event: 'CarrierCrewServices', CarrierID: 42, CrewRole: 'repair', Operation: 'deactivate' })
    service.ingest({ timestamp: '2026-10-10T09:00:00Z', event: 'CarrierLocation', CarrierID: 42, StarSystem: 'Sol', SystemAddress: 1 })
    service.ingest(carrierStats); service.ingest(carrierStats)
    expect(service.getCarriers()).toHaveLength(1)
    expect(service.getCarriers()[0]).toMatchObject({ name: 'Synthetic carrier', location: { system: 'Sol' }, fuel: { tonnes: 800 },
      finance: { balance: 1000000020, reserves: null, available: null }, services: { changedAt: '2026-10-10T10:30:00.000Z', items: [{ active: true }] } })
    expect(service.getCarriers()[0]?.history).toHaveLength(4)
    service.ingest({ ...carrierStats, timestamp: '2026-10-09T10:00:00Z', FuelLevel: 50 })
    expect(service.getCarriers()[0]?.fuel?.tonnes).toBe(800)
    service.ingest({ ...carrierStats, timestamp: '2026-10-10T12:00:00Z', FuelLevel: 0 })
    expect(service.getCarriers()[0]).toMatchObject({ fuel: { tonnes: 0 }, finance: { reserves: 100000000 }, services: { changedAt: null } })
    service.ingest({ ...carrierStats, timestamp: 'invalid', FuelLevel: 100 })
    service.ingest({ ...carrierStats, timestamp: '2026-10-10T13:00:00Z', FuelLevel: -1 })
    expect(service.getCarriers()[0]?.fuel?.tonnes).toBe(0)
  } finally { database.close() }
})

test('jump schedule/cancellation/location are observed facts, not deadline inference or foreign/ship arrival; fuel totals are authoritative', () => {
  const database = new SqliteDatabase(':memory:'); database.initialize()
  try {
    const service = new CarrierDataService(database.carriers)
    service.ingest(carrierStats)
    const request = { timestamp: '2026-10-10T10:10:00Z', event: 'CarrierJumpRequest', CarrierID: 42, SystemName: 'Colonia', SystemAddress: 2, BodyID: 1, Body: 'Colonia 1', DepartureTime: '2026-10-10T10:25:00Z' }
    service.ingest(request)
    service.ingest({ timestamp: '2026-10-10T10:30:00Z', event: 'CarrierJump', MarketID: 99, StarSystem: 'Colonia', SystemAddress: 2 })
    service.ingest({ timestamp: '2026-10-10T10:30:00Z', event: 'FSDJump', StarSystem: 'Colonia', SystemAddress: 2 })
    expect(service.getCarriers()[0]?.jump?.status).toBe('scheduled')
    service.ingest({ timestamp: '2026-10-10T10:40:00Z', event: 'CarrierJumpCancelled', CarrierID: 42 })
    expect(service.getCarriers()[0]?.jump?.status).toBe('cancelled')
    service.ingest({ ...request, timestamp: '2026-10-10T11:00:00Z' })
    service.ingest({ timestamp: '2026-10-10T11:10:00Z', event: 'CarrierLocation', CarrierID: 42, StarSystem: 'Colonia', SystemAddress: 2, BodyID: 2 })
    expect(service.getCarriers()[0]?.jump?.status).toBe('scheduled')
    service.ingest({ timestamp: '2026-10-10T11:30:00Z', event: 'CarrierJump', MarketID: 42, StarSystem: 'Colonia', SystemAddress: 2, BodyID: 1 })
    expect(service.getCarriers()[0]).toMatchObject({ jump: { status: 'arrival-observed' }, fuel: null, location: { system: 'Colonia' } })
    service.ingest({ timestamp: '2026-10-10T11:40:00Z', event: 'CarrierDepositFuel', CarrierID: 42, Amount: 10, Total: 300 })
    expect(service.getCarriers()[0]?.fuel).toMatchObject({ tonnes: 300, currentRange: null })
  } finally { database.close() }
})

test('purchase-only records preserve unknown fields and carrier history is bounded and idempotent', () => {
  const database = new SqliteDatabase(':memory:'); database.initialize()
  try {
    const service = new CarrierDataService(database.carriers)
    service.ingest({ timestamp: '2026-10-10T08:00:00Z', event: 'CarrierBuy', CarrierID: 42, Callsign: 'SYN-001', Location: 'Sol', SystemAddress: 1, Price: 5000000000 })
    expect(service.getCarriers()[0]).toMatchObject({ snapshotAt: null, fuel: null, capacity: null, finance: null, services: null, location: { system: 'Sol' } })
    for (let index = 0; index < 110; index++) {
      const event = { timestamp: new Date(Date.UTC(2026, 9, 10, 9, index)).toISOString(), event: 'CarrierTradeOrder', CarrierID: 42, Commodity: 'steel', Price: 100, PurchaseOrder: index }
      service.ingest(event); service.ingest(event)
    }
    expect(service.getCarriers()[0]?.history).toHaveLength(100)
    expect(service.getCarriers()[0]?.capacity).toBeNull()
  } finally { database.close() }
})

test('updated observation kinds preserve same-second ingestion order and duplicate replay cannot change it', () => {
  const database = new SqliteDatabase(':memory:'); database.initialize()
  try {
    const service = new CarrierDataService(database.carriers)
    const oldService = { timestamp: '2026-10-10T09:00:00Z', event: 'CarrierCrewServices', CarrierID: 42, CrewRole: 'repair', Operation: 'activate' }
    const newService = { ...oldService, timestamp: carrierStats.timestamp, Operation: 'deactivate' }
    service.ingest(oldService)
    service.ingest(carrierStats)
    service.ingest(newService)
    expect(service.getCarriers()[0]?.services?.changedAt).toBe('2026-10-10T10:00:00.000Z')
    service.ingest(carrierStats); service.ingest(oldService)
    expect(service.getCarriers()[0]?.services?.changedAt).toBe('2026-10-10T10:00:00.000Z')
    expect(service.getCarriers()[0]?.history[0]?.kind).toBe('CarrierCrewServices')
  } finally { database.close() }
})
