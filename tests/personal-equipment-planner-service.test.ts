import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import type { CommanderEquipmentResponse, PersonalMaterialInventoryResponse } from '@phoenix/contracts'
import { JsonPersonalEquipmentCatalogue } from '@phoenix/elite'
import { PersonalEquipmentPlannerService } from '../apps/server/src/application/personal-equipment-planner-service.js'

const fixture = join(fileURLToPath(new URL('./fixtures/catalogue/', import.meta.url)), 'personal-equipment.json')

describe('personal equipment planner service', () => {
  test('resolves observed equipment and subtracts the observed material inventory', () => {
    const service = new PersonalEquipmentPlannerService(
      new JsonPersonalEquipmentCatalogue(fixture),
      { getEquipment: () => equipment() },
      { getInventory: () => inventory() }
    )

    expect(service.getOptions().equipment[0]).toMatchObject({
      id: 'test-suit',
      observedInstances: [{ instanceId: 42, grade: 1 }],
      modifications: [{ id: 'suit_test', name: 'Test Modification' }]
    })
    expect(service.preview({
      source: { kind: 'observed', equipmentKind: 'suit', instanceId: 42 },
      targetGrade: 2,
      plannedModificationIds: ['suit_test']
    })).toMatchObject({
      equipment: { id: 'test-suit', source: 'observed' },
      slots: { installed: 0, planned: 1, remaining: 0 },
      materials: [{ materialId: 'test-material', owned: 1, required: 3, missing: 2 }],
      specialists: [{ id: 'test-engineer', name: 'Test Engineer' }]
    })
  })

  test('keeps unresolved installed modifications as occupied slots and reports them', () => {
    const observed = equipment()
    observed.suits[0]!.grade = 2
    observed.suits[0]!.modifications = [{ symbol: 'future_modification', displayName: 'Future Modification' }]
    const service = new PersonalEquipmentPlannerService(
      new JsonPersonalEquipmentCatalogue(fixture),
      { getEquipment: () => observed },
      { getInventory: () => inventory() }
    )

    const preview = service.preview({
      source: { kind: 'observed', equipmentKind: 'suit', instanceId: 42 },
      targetGrade: 2,
      plannedModificationIds: []
    })
    expect(preview.slots.installed).toBe(1)
    expect(preview.unresolvedInstalledModifications).toEqual([{ symbol: 'future_modification', name: 'Future Modification' }])
  })
})

function equipment (): CommanderEquipmentResponse {
  return {
    schemaVersion: 1,
    ownershipCoverage: 'observed',
    currentLoadoutId: null,
    updatedAt: '2026-09-15T00:00:00.000Z',
    loadouts: [],
    suits: [{
      id: 42,
      symbol: 'test_suit_class1',
      displayName: 'Test Suit',
      grade: 1,
      modifications: [],
      purchasePrice: null,
      purchasedAt: null,
      lastUpgrade: null,
      loadoutIds: [],
      updatedAt: '2026-09-15T00:00:00.000Z'
    }],
    weapons: [],
    summary: { loadouts: 0, suits: 1, weapons: 0 }
  }
}

function inventory (): PersonalMaterialInventoryResponse {
  return {
    schemaVersion: 1,
    updatedAt: null,
    stores: { shipLockerUpdatedAt: null, backpackUpdatedAt: null },
    groups: [
      { id: 'goods', label: 'Goods', items: [{
        id: 'test-material', name: 'Test Material', group: 'goods', shipLocker: 1, backpack: 0,
        observedTotal: 1, missionTagged: 0
      }] },
      { id: 'assets', label: 'Assets', items: [] },
      { id: 'data', label: 'Data', items: [] },
      { id: 'consumables', label: 'Consumables', items: [] }
    ]
  }
}
