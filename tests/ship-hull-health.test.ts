import { expect, test } from 'vitest'
import type { GameEventEnvelope, RuntimeState } from '@phoenix/contracts'
import type { EliteJournalEvent } from '@phoenix/elite'
import { EliteJournalIngestionService } from '../apps/server/src/application/elite-journal-ingestion-service.js'
import { GameEventIngestionService } from '../apps/server/src/application/game-event-ingestion-service.js'
import { DefaultRuntimeStateProjector } from '../apps/server/src/application/default-runtime-state-projector.js'
import { InMemoryRuntimeStateStore } from '../apps/server/src/infrastructure/in-memory-runtime-state-store.js'
import { InProcessPublisher } from '../apps/server/src/infrastructure/in-process-publisher.js'
import { createDashboardViewModel } from '../apps/web/src/features/dashboard/dashboard-view-model.js'
import { createCurrentShipModel } from '../apps/web/src/features/fleet/fleet-view-model.js'

function setup () {
  const store = new InMemoryRuntimeStateStore()
  const updates = new InProcessPublisher<RuntimeState>()
  const events = new InProcessPublisher<GameEventEnvelope>()
  const projector = new DefaultRuntimeStateProjector(store, updates)
  events.subscribe(event => projector.project(event))
  const journal = new EliteJournalIngestionService(new GameEventIngestionService(events))
  const published: RuntimeState[] = []
  updates.subscribe(state => published.push(state))
  const ingest = (event: string, fields: Record<string, unknown> = {}) => journal.ingest({
    timestamp: '2026-10-02T20:20:19Z', event, ...fields
  } as EliteJournalEvent)
  ingest('Loadout', { Ship: 'explorer_nx', ShipID: 15, HullHealth: 0.629874, ShipName: 'Test ship', Modules: [] })
  return { store, ingest, published }
}

test('module repairs update shared health without inventing power state', () => {
  const { store, ingest, published } = setup()
  ingest('Loadout', { Ship: 'explorer_nx', ShipID: 15, HullHealth: 0.63, Modules: [
    { Slot: 'MainEngines', Item: 'int_engine_size7_class5_gravityoptimised_mkii', On: false, Health: 0.7, Priority: 0 },
    { Slot: 'Slot08_Size4', Item: 'int_repairer_size4_class5', On: false, Health: 0.8, Priority: 0 }
  ] })
  expect(createCurrentShipModel(store.getCurrent()).moduleStatus.damaged).toHaveLength(2)
  ingest('AfmuRepairs', { Module: '$int_engine_size7_class5_gravityoptimised_mkii_name;', Health: 0.95, FullyRepaired: false })
  expect(store.getCurrent().ship.modules[0]).toMatchObject({ health: 0.95, enabled: false })
  expect(published.at(-1)!.ship.modules[0]!.health).toBe(0.95)
  for (const Health of [-1, 2, null, '1']) {
    ingest('AfmuRepairs', { Module: '$int_engine_size7_class5_gravityoptimised_mkii_name;', Health })
  }
  expect(store.getCurrent().ship.modules[0]!.health).toBe(0.95)
  ingest('Repair', { Items: ['Wear', 'Paint', 'Hull'] })
  expect(store.getCurrent().ship.modules.map(module => module.health)).toEqual([0.95, 0.8])
  ingest('Repair', { Item: 'int_repairer_size4_class5' })
  expect(store.getCurrent().ship.modules[1]).toMatchObject({ health: 1, enabled: false })
  ingest('RepairAll')
  expect(store.getCurrent().ship.modules.map(module => module.health)).toEqual([1, 1])
  expect(createCurrentShipModel(store.getCurrent()).moduleStatus.damaged).toEqual([])
})

test('slotless repairs do not falsely repair every identical installed module', () => {
  const { store, ingest } = setup()
  ingest('Loadout', { Ship: 'explorer_nx', ShipID: 15, Modules: [
    { Slot: 'TinyHardpoint1', Item: 'hpt_heatsinklauncher_turret_tiny', Health: 0.5 },
    { Slot: 'TinyHardpoint2', Item: 'hpt_heatsinklauncher_turret_tiny', Health: 0.8 }
  ] })
  ingest('AfmuRepairs', { Module: '$hpt_heatsinklauncher_turret_tiny_name;', Health: 1 })
  expect(store.getCurrent().ship.modules.map(module => module.health)).toEqual([null, null])
  expect(createCurrentShipModel(store.getCurrent()).moduleStatus.unknown).toBe(2)
  ingest('Repair', { Items: ['all'] })
  expect(store.getCurrent().ship.modules.map(module => module.health)).toEqual([1, 1])
})

test('real damage and repair sequence updates both dashboards through the shared runtime', () => {
  const { store, ingest, published } = setup()
  const assertHull = (health: number | null, label: string) => {
    const state = store.getCurrent()
    expect(state.ship.hullHealth).toBe(health)
    expect(createDashboardViewModel(state, undefined, [], []).ship.hull).toBe(label)
    expect(createCurrentShipModel(state).integrity[0]!.valueLabel).toBe(label)
    expect(published.at(-1)!.ship.hullHealth).toBe(health)
    expect(state.ship).toMatchObject({ id: 15, typeId: 'explorer_nx', name: 'Test ship' })
  }
  assertHull(0.629874, '63%')
  ingest('HullDamage', { Health: 0.599876, PlayerPilot: true, Fighter: false })
  assertHull(0.599876, '60%')
  ingest('RepairDrone', { HullRepaired: 310.000214, CockpitRepaired: 0.17805 })
  assertHull(null, '—')
  ingest('RepairAll', { Cost: 37050 })
  assertHull(1, '100%')
  ingest('Repair', { Items: ['Wear'], Cost: 114384 })
  assertHull(1, '100%')
})

test.each([{ Item: 'Hull' }, { Item: 'all' }, { Items: ['Hull', 'int_powerplant'] }, { Items: ['All'] }])(
  'targeted hull repairs restore hull health: %j', fields => {
    const { store, ingest } = setup()
    ingest('Repair', fields)
    expect(store.getCurrent().ship.hullHealth).toBe(1)
  }
)

test('fighter damage, module repairs, wear, paint and non-hull drone repairs leave ship hull alone', () => {
  const { store, ingest } = setup()
  ingest('HullDamage', { Health: 0.2, PlayerPilot: true, Fighter: true })
  ingest('Repair', { Item: 'wear' })
  ingest('Repair', { Items: ['Paint', 'int_powerplant'] })
  ingest('AfmuRepairs', { Module: 'int_powerplant', Health: 1, FullyRepaired: true })
  ingest('RepairDrone', { HullRepaired: 0, CockpitRepaired: 5 })
  ingest('RepairDrone', { CorrosionRepaired: 5 })
  for (const Health of [-0.1, 1.5, '0.8', null]) ingest('HullDamage', { Health, Fighter: false })
  expect(store.getCurrent().ship.hullHealth).toBe(0.629874)
})

test('unpiloted mothership damage counts and fresh loadout restores certainty after a limpet repair', () => {
  const { store, ingest } = setup()
  ingest('HullDamage', { Health: 0.4, Fighter: false, PlayerPilot: false })
  expect(store.getCurrent().ship.hullHealth).toBe(0.4)
  ingest('RepairDrone', { HullRepaired: 20 })
  expect(store.getCurrent().ship.hullHealth).toBeNull()
  ingest('Loadout', { Ship: 'explorer_nx', ShipID: 15, HullHealth: 0.97 })
  expect(store.getCurrent().ship.hullHealth).toBe(0.97)
})
