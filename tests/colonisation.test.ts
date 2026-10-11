import { expect, test } from 'vitest'
import { createEmptyRuntimeState } from '@phoenix/contracts'
import { SqliteDatabase } from '../apps/server/src/infrastructure/sqlite-database.js'
import { ColonisationDataService } from '../apps/server/src/application/colonisation-data-service.js'

test('construction totals are snapshots, contributions deduplicate without asserting ownership or increasing global totals', () => {
  const database = new SqliteDatabase(':memory:')
  database.initialize()
  try {
    const service = new ColonisationDataService(database.colonisation)
    const state = createEmptyRuntimeState()
    const depot = { timestamp: '2026-10-10T10:00:00Z', event: 'ColonisationConstructionDepot', MarketID: 42,
      ConstructionProgress: 0.25, ConstructionComplete: false, ConstructionFailed: false,
      ResourcesRequired: [{ Name: '$steel_name;', Name_Localised: 'Steel', RequiredAmount: 200, ProvidedAmount: 50, Payment: 1500 }] }
    service.ingest(depot, state)
    const contribution = { timestamp: '2026-10-10T10:01:00Z', event: 'ColonisationContribution', MarketID: 42,
      Contributions: [{ Name: '$steel_name;', Name_Localised: 'Steel', Amount: 20 }] }
    service.ingest(contribution, state); service.ingest(contribution, state)
    expect(service.getColonisation()).toMatchObject({ claims: [], retainedContributions: 1,
      depots: [{ marketId: 42, system: null, station: null, resources: [{ required: 200, provided: 50 }] }] })
    service.ingest({ ...depot, timestamp: '2026-10-09T10:00:00Z', ConstructionProgress: 0.1 }, state)
    expect(service.getColonisation().depots[0]?.progress).toBe(0.25)
    service.ingest({ ...depot, timestamp: '2026-10-10T11:00:00Z', ConstructionProgress: 1, ConstructionComplete: true }, state)
    expect(service.getColonisation().depots[0]).toMatchObject({ complete: true, progress: 1 })
    service.ingest({ ...depot, timestamp: '2026-10-10T12:00:00Z', ConstructionProgress: 2 }, state)
    expect(service.getColonisation().depots[0]?.progress).toBe(1)
    const claim = { timestamp: '2026-10-10T09:00:00Z', event: 'ColonisationSystemClaim', StarSystem: 'Synthetic system', SystemAddress: 123 }
    service.ingest(claim, state)
    service.ingest({ ...claim, timestamp: '2026-10-10T12:00:00Z', event: 'ColonisationSystemClaimRelease' }, state)
    service.ingest(claim, state)
    expect(service.getColonisation().claims[0]?.status).toBe('released')
    state.system.name = 'Synthetic system'
    state.location.place = { kind: 'station', name: 'Synthetic depot', type: null, marketId: 42, faction: null,
      government: null, primaryEconomy: null, economies: [], services: [] }
    service.ingest({ ...depot, timestamp: '2026-10-10T13:00:00Z' }, state)
    expect(service.getColonisation().depots[0]).toMatchObject({ system: 'Synthetic system', station: 'Synthetic depot' })
    service.ingest({ ...depot, MarketID: 99, timestamp: '2026-10-10T14:00:00Z' }, state)
    expect(service.getColonisation().depots[0]).toMatchObject({ marketId: 99, system: null, station: null })
  } finally { database.close() }
})
