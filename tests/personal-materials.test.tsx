import { createEmptyRuntimeState } from '@phoenix/contracts'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vitest'
import { PersonalMaterialInventoryService } from '../apps/server/src/application/personal-material-inventory-service.js'
import { InMemoryRuntimeStateStore } from '../apps/server/src/infrastructure/in-memory-runtime-state-store.js'
import { EquipmentMaterialsPage } from '../apps/web/src/features/equipment/equipment-materials-page.js'

test('personal material inventory preserves store coverage and aggregates observed resource lots', () => {
  const runtime = new InMemoryRuntimeStateStore()
  const empty = createEmptyRuntimeState()
  runtime.replace({
    ...empty,
    inventory: {
      ...empty.inventory,
      shipLocker: {
        updatedAt: '2026-09-15T19:00:00.000Z',
        items: [
          { id: 'chemicalsample', label: 'Chemical Sample', count: 2, ownerId: null, missionId: null },
          { id: 'chemicalsample', label: 'Chemical Sample', count: 1, ownerId: null, missionId: 42 }
        ],
        components: [{ id: 'weaponcomponent', label: 'Weapon Component', count: 3, ownerId: null, missionId: null }],
        consumables: [],
        data: []
      },
      backpack: {
        updatedAt: '2026-09-15T19:05:00.000Z',
        items: [{ id: 'chemicalsample', label: 'Chemical Sample', count: 4, ownerId: null, missionId: null }],
        components: [],
        consumables: [],
        data: [{ id: 'manufacturinginstructions', label: null, count: 2, ownerId: null, missionId: null }]
      }
    }
  })

  const inventory = new PersonalMaterialInventoryService(runtime).getInventory()

  expect(inventory).toMatchObject({
    schemaVersion: 1,
    updatedAt: '2026-09-15T19:05:00.000Z',
    stores: {
      shipLockerUpdatedAt: '2026-09-15T19:00:00.000Z',
      backpackUpdatedAt: '2026-09-15T19:05:00.000Z'
    }
  })
  expect(inventory.groups.map(group => [group.id, group.label])).toEqual([
    ['goods', 'Goods'],
    ['assets', 'Assets'],
    ['data', 'Data'],
    ['consumables', 'Consumables']
  ])
  expect(inventory.groups[0]?.items).toEqual([{
    id: 'chemicalsample',
    name: 'Chemical Sample',
    group: 'goods',
    shipLocker: 3,
    backpack: 4,
    observedTotal: 7,
    missionTagged: 1
  }])
  expect(inventory.groups[2]?.items[0]).toMatchObject({
    id: 'manufacturinginstructions',
    name: 'Manufacturinginstructions',
    shipLocker: 0,
    backpack: 2,
    observedTotal: 2
  })
})

test('an unreported store remains unknown rather than becoming zero', () => {
  const runtime = new InMemoryRuntimeStateStore()
  const empty = createEmptyRuntimeState()
  runtime.replace({
    ...empty,
    inventory: {
      ...empty.inventory,
      shipLocker: {
        updatedAt: '2026-09-15T19:00:00.000Z',
        items: [{ id: 'chemicalsample', label: 'Chemical Sample', count: 2, ownerId: null, missionId: null }],
        components: [], consumables: [], data: []
      }
    }
  })

  const inventory = new PersonalMaterialInventoryService(runtime).getInventory()

  expect(inventory.groups[0]?.items[0]).toMatchObject({ shipLocker: 2, backpack: null, observedTotal: 2 })
})

test('personal materials page presents journal stores side by side', () => {
  const runtime = new InMemoryRuntimeStateStore()
  const empty = createEmptyRuntimeState()
  runtime.replace({
    ...empty,
    inventory: {
      ...empty.inventory,
      shipLocker: {
        updatedAt: '2026-09-15T19:00:00.000Z',
        items: [{ id: 'chemicalsample', label: 'Chemical Sample', count: 2, ownerId: null, missionId: null }],
        components: [], consumables: [], data: []
      }
    }
  })
  const inventory = new PersonalMaterialInventoryService(runtime).getInventory()
  const markup = renderToStaticMarkup(<EquipmentMaterialsPage controller={{ inventory, status: 'ready' }} />)

  expect(markup).toContain('<h1>Materials</h1>')
  expect(markup).toContain('<h2>Goods</h2>')
  expect(markup).toContain('Chemical Sample')
  expect(markup).toContain('<th class="numeric">Ship locker</th>')
  expect(markup).toContain('<th class="numeric">Backpack</th>')
  expect(markup).toContain('<td class="numeric">—</td>')
})
