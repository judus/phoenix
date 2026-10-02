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
