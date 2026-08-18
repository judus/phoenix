import { fileURLToPath } from 'node:url'
import { expect, test } from 'vitest'
import type { CurrentShip } from '@phoenix/contracts'
import { JsonGameCatalogue } from '@phoenix/elite'
import { CatalogueShipLoadoutEnricher } from '../apps/server/src/application/catalogue-ship-loadout-enricher.js'

const projectRoot = fileURLToPath(new URL('../', import.meta.url))
const catalogue = new JsonGameCatalogue(
  `${projectRoot}tests/fixtures/catalogue/ships.json`,
  `${projectRoot}tests/fixtures/catalogue/modules.json`
)

test('catalogue resolves journal aliases and ship definitions', () => {
  const ship = catalogue.resolveShip('testhopper')
  expect(ship).toMatchObject({
    id: 'test_hopper',
    displayName: 'Test Hopper',
    manufacturer: 'Fixture Works',
    landingPadSize: 'medium',
    performance: { baseArmour: 100, baseShieldStrength: 50 },
    source: { kind: 'catalogue', name: 'PHOENIX synthetic test catalogue' }
  })
  expect(ship?.slots.hardpoints).toHaveLength(1)
})

test('catalogue lists canonical hulls alphabetically without exposing mutable storage', () => {
  const ships = catalogue.listShips()
  expect(ships).toHaveLength(3)
  expect(ships.map(ship => ship.displayName)).toEqual(
    [...ships].map(ship => ship.displayName).sort((left, right) => left.localeCompare(right))
  )
  ships[0]!.displayName = 'Mutated by caller'
  expect(catalogue.listShips()[0]?.displayName).not.toBe('Mutated by caller')
})

test('catalogue resolves known modules and labels unknown new modules as inferred', () => {
  expect(catalogue.resolveModule('int_testpowerplant_size4_class5')).toMatchObject({
    displayName: 'Test Power Plant',
    size: 4,
    rating: 'A',
    source: { kind: 'catalogue', name: 'PHOENIX synthetic test catalogue' }
  })
  expect(catalogue.resolveModule('hpt_testlaser_fixed_medium')).toMatchObject({
    displayName: 'Test Laser',
    size: 2,
    mount: 'Fixed',
    source: { kind: 'catalogue' }
  })
})

test('loadout enrichment keeps observed fields separate from expected hull slots', () => {
  const ship = emptyShip('testhopper')
  ship.modules = [
    emptyModule('PowerPlant', 'int_testpowerplant_size4_class5', 'core', 4),
    emptyModule('MediumHardpoint1', 'hpt_testlaser_fixed_medium', 'hardpoint', 2),
    emptyModule('TinyHardpoint1', 'hpt_testutility_turret_tiny', 'utility', null),
    emptyModule('Slot01_Size3', 'int_testmodule_size3_class5', 'optional', 3)
  ]

  const enriched = new CatalogueShipLoadoutEnricher(catalogue).enrich(ship)
  expect(enriched.definition?.displayName).toBe('Test Hopper')
  expect(enriched.modules.map(module => ({
    slotId: module.slotId,
    observedSize: module.slotSize,
    expectedSize: module.expectedSlot?.size,
    expectedName: module.expectedSlot?.name,
    source: module.definition?.source.kind
  }))).toEqual([
    { slotId: 'PowerPlant', observedSize: 4, expectedSize: 4, expectedName: 'Power Plant', source: 'catalogue' },
    { slotId: 'MediumHardpoint1', observedSize: 2, expectedSize: 2, expectedName: 'Test hardpoint', source: 'catalogue' },
    { slotId: 'TinyHardpoint1', observedSize: null, expectedSize: 0, expectedName: undefined, source: 'inferred' },
    { slotId: 'Slot01_Size3', observedSize: 3, expectedSize: undefined, expectedName: undefined, source: 'inferred' }
  ])
})

function emptyShip (typeId: string): CurrentShip {
  return {
    id: null,
    typeId,
    definition: null,
    name: null,
    identifier: null,
    hullHealth: null,
    hullValue: null,
    modulesValue: null,
    unladenMass: null,
    cargoCapacity: null,
    maxJumpRange: null,
    fuelCapacity: null,
    rebuy: null,
    modules: []
  }
}

function emptyModule (
  slotId: string,
  moduleId: string,
  slotGroup: CurrentShip['modules'][number]['slotGroup'],
  slotSize: number | null
): CurrentShip['modules'][number] {
  return {
    slotId,
    slotGroup,
    slotSize,
    expectedSlot: null,
    moduleId,
    moduleSize: slotSize,
    moduleClass: null,
    definition: null,
    enabled: true,
    priority: 0,
    health: 1,
    value: null,
    ammo: null,
    engineering: null
  }
}
