import { createEmptyRuntimeState } from '@phoenix/contracts'
import { expect, test } from 'vitest'
import {
  createCurrentShipModel,
  createFleetOverviewModel,
  createStoredModulesModel
} from '../apps/web/src/features/fleet/fleet-view-model.js'
import { fleetFixture } from './fixtures/fleet-fixture.js'

test('current ship model keeps raw identifiers and derives live capacity evidence', () => {
  const empty = createEmptyRuntimeState()
  const state = {
    ...empty,
    ship: {
      ...empty.ship,
      name: 'Prospector',
      identifier: 'EL-06L',
      hullHealth: 0.86,
      cargoCapacity: 32,
      modules: [{
        slotId: 'Slot01', slotGroup: 'core' as const, slotSize: 5, expectedSlot: null,
        moduleId: '$int_hyperdrive_size5_class5_name;', moduleSize: 5, moduleClass: 5,
        definition: null, enabled: true, priority: 2, health: 0.9, value: null, ammo: null, engineering: null
      }]
    },
    inventory: {
      ...empty.inventory,
      cargo: {
        updatedAt: '2026-08-16T12:00:00.000Z', vessel: 'ship' as const,
        items: [{ id: 'gold', label: null, count: 4, stolen: 1, missionId: null }]
      }
    }
  }
  const model = createCurrentShipModel(state)

  expect(model.title).toBe('Prospector')
  expect(model.integrity[0]).toMatchObject({ value: 86, valueLabel: '86%' })
  expect(model.cargo).toMatchObject({ count: 4, capacity: 32 })
  expect(model.cargo.items[0]).toMatchObject({ label: 'gold', detail: '1 stolen' })
  expect(model.modules[0]?.items[0]).toMatchObject({ module: '$int_hyperdrive_size5_class5_name;', condition: '90%' })
})

test('fleet models preserve authority distinctions and stored-module provenance', () => {
  const fleet = fleetFixture()
  const overview = createFleetOverviewModel(fleet)
  const storage = createStoredModulesModel(fleet)

  expect(overview.ships[0]).toMatchObject({ active: true, name: 'MURDOCK', detail: 'Viper Mk IV · VI-04' })
  expect(overview.assets[1]).toEqual({ label: 'Fleet carriers', value: 0, detail: 'No authoritative record observed' })
  expect(storage.details).toBe('Complete snapshot')
  expect(storage.groups[0]?.items[0]).toMatchObject({
    identifier: '$int_engine_size5_class5_name; · Hot',
    engineering: 'DirtyDrive G2'
  })
})
