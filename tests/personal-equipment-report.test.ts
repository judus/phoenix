import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from 'vitest'
import {
  createEmptyRuntimeState,
  type CommanderEquipmentResponse,
  type PersonalMaterialInventoryResponse
} from '@phoenix/contracts'
import { JsonEngineeringCatalogue, JsonPersonalEquipmentCatalogue } from '@phoenix/elite'
import { PersonalEquipmentPlannerService } from '../apps/server/src/application/personal-equipment-planner-service.js'
import { PersonalEquipmentReportService } from '../apps/server/src/application/personal-equipment-report-service.js'
import { PersonalEquipmentSpecialistsService } from '../apps/server/src/application/personal-equipment-specialists-service.js'
import { PersonalEquipmentUpgradesService } from '../apps/server/src/application/personal-equipment-upgrades-service.js'
import { InMemoryRuntimeStateStore } from '../apps/server/src/infrastructure/in-memory-runtime-state-store.js'

const catalogueFixture = join(fileURLToPath(new URL('./fixtures/catalogue/', import.meta.url)), 'personal-equipment.json')
const engineeringFixture = fileURLToPath(new URL('./fixtures/catalogue/engineering/', import.meta.url))

test('equipment report joins observations, rules, inventory and specialist access once', () => {
  const catalogue = new JsonPersonalEquipmentCatalogue(catalogueFixture)
  const runtime = new InMemoryRuntimeStateStore()
  const empty = createEmptyRuntimeState()
  runtime.replace({
    ...empty,
    commander: {
      ...empty.commander,
      engineerAccessCoverage: 'complete',
      engineers: [{ id: 900002, name: 'Test Engineer', status: 'Unlocked', rank: 0, rankProgress: 0 }]
    },
    system: { ...empty.system, position: [1, 2, 3] }
  })
  const equipmentReader = { getEquipment: equipment }
  const materialReader = { getInventory: inventory }
  const planner = new PersonalEquipmentPlannerService(catalogue, equipmentReader, materialReader)
  const report = new PersonalEquipmentReportService(
    equipmentReader,
    materialReader,
    new PersonalEquipmentUpgradesService(catalogue),
    new PersonalEquipmentSpecialistsService(catalogue, engineeringCatalogue(), runtime),
    planner
  ).getReport()

  expect(report).toMatchObject({
    schemaVersion: 1,
    catalogueVersion: '0000000000000000000000000000000000000000',
    coverage: {
      ownership: 'observed',
      shipLockerUpdatedAt: '2026-09-15T00:00:00.000Z',
      backpackUpdatedAt: '2026-09-15T00:05:00.000Z',
      materialInventoryComplete: true
    },
    currentLoadoutId: 7,
    loadouts: [{ id: 7, current: true, suitId: 42 }],
    ownedEquipment: [{
      kind: 'suit',
      instanceId: 42,
      definitionId: 'test-suit',
      grade: 1,
      modificationSlots: { total: 0, installed: 0, remaining: 0 },
      loadoutIds: [7]
    }],
    materials: [{ id: 'test-material', observedTotal: 3, missionTagged: 1 }],
    equipmentDefinitions: [{ id: 'test-suit', compatibleModificationIds: ['suit_test'] }],
    gradeUpgradePaths: [{ targetId: 'test-suit', steps: [{ ingredients: [{ materialId: 'test-material', count: 2 }] }] }],
    modifications: [{ id: 'suit_test', specialistIds: ['test-engineer'] }],
    specialists: [{ id: 'test-engineer', access: { state: 'unlocked' }, modificationIds: ['suit_test'] }],
    unknowns: []
  })
})

function equipment (): CommanderEquipmentResponse {
  return {
    schemaVersion: 1,
    ownershipCoverage: 'observed',
    currentLoadoutId: 7,
    updatedAt: '2026-09-15T00:00:00.000Z',
    loadouts: [{
      id: 7,
      name: 'Field test',
      suitId: 42,
      slots: [],
      updatedAt: '2026-09-15T00:00:00.000Z'
    }],
    suits: [{
      id: 42,
      symbol: 'test_suit_class1',
      displayName: 'Test Suit',
      grade: 1,
      modifications: [],
      purchasePrice: null,
      purchasedAt: null,
      lastUpgrade: null,
      loadoutIds: [7],
      updatedAt: '2026-09-15T00:00:00.000Z'
    }],
    weapons: [],
    summary: { loadouts: 1, suits: 1, weapons: 0 }
  }
}

function inventory (): PersonalMaterialInventoryResponse {
  return {
    schemaVersion: 1,
    updatedAt: '2026-09-15T00:05:00.000Z',
    stores: {
      shipLockerUpdatedAt: '2026-09-15T00:00:00.000Z',
      backpackUpdatedAt: '2026-09-15T00:05:00.000Z'
    },
    groups: [
      { id: 'goods', label: 'Goods', items: [{
        id: 'test-material',
        name: 'Test Material',
        group: 'goods',
        shipLocker: 2,
        backpack: 1,
        observedTotal: 3,
        missionTagged: 1
      }] },
      { id: 'assets', label: 'Assets', items: [] },
      { id: 'data', label: 'Data', items: [] },
      { id: 'consumables', label: 'Consumables', items: [] }
    ]
  }
}

function engineeringCatalogue (): JsonEngineeringCatalogue {
  return new JsonEngineeringCatalogue({
    blueprints: join(engineeringFixture, 'blueprints.json'),
    engineers: join(engineeringFixture, 'engineers.json'),
    materials: join(engineeringFixture, 'materials.json'),
    materialUses: join(engineeringFixture, 'material-uses.json')
  })
}
