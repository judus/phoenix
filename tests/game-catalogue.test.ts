import { fileURLToPath } from 'node:url'
import { expect, test } from 'vitest'
import type { CurrentShip } from '@phoenix/contracts'
import { JsonGameCatalogue } from '@phoenix/elite'
import { CatalogueShipLoadoutEnricher } from '../apps/server/src/application/catalogue-ship-loadout-enricher.js'

const projectRoot = fileURLToPath(new URL('../', import.meta.url))
const catalogue = new JsonGameCatalogue(
  `${projectRoot}data/catalogue/ships.json`,
  `${projectRoot}data/catalogue/modules.json`
)

test('catalogue resolves Frontier journal aliases and the verified Type-11 hull', () => {
  expect(catalogue.resolveShip('CobraMkIII')?.displayName).toBe('Cobra Mk III')

  const type11 = catalogue.resolveShip('lakonminer')
  expect(type11).toMatchObject({
    id: 'type_11_prospector',
    displayName: 'Type-11 Prospector',
    manufacturer: 'Lakon',
    landingPadSize: 'medium',
    performance: { baseArmour: 350, baseShieldStrength: 275 },
    source: { kind: 'catalogue', name: 'EDCD Coriolis Data' }
  })
  expect(type11?.slots).toMatchObject({
    core: [{ size: 6 }, { size: 5 }, { size: 5 }, { size: 3 }, { size: 7 }, { size: 3 }, { size: 5 }],
    utilities: [{ size: 0 }, { size: 0 }, { size: 0 }, { size: 0 }]
  })
  expect(type11?.slots.hardpoints).toHaveLength(8)
  expect(type11?.slots.optional).toHaveLength(13)
})

test('catalogue resolves known modules and labels unknown new modules as inferred', () => {
  expect(catalogue.resolveModule('int_powerplant_size6_class5')).toMatchObject({
    displayName: 'Power Plant',
    size: 6,
    rating: 'A',
    source: { kind: 'catalogue', name: 'EDCD FDevIDs' }
  })
  expect(catalogue.resolveModule('hpt_miningtoolv2_fixed_large')).toMatchObject({
    displayName: 'Mining Tool V2',
    size: 3,
    mount: 'Fixed',
    source: { kind: 'inferred' }
  })
})

test('loadout enrichment keeps observed fields separate from expected hull slots', () => {
  const ship = emptyShip('lakonminer')
  ship.modules = [
    emptyModule('PowerPlant', 'int_powerplant_size6_class5', 'core', 6),
    emptyModule('LargeMiningHardpoint1', 'hpt_miningtoolv2_fixed_large', 'hardpoint', 3),
    emptyModule('TinyHardpoint4', 'hpt_plasmapointdefence_turret_tiny', 'utility', null),
    emptyModule('LimpetController01', 'int_multidronecontrol_miningv2_size5_class5', 'optional', 5),
    emptyModule('Slot06_Size4', 'int_refinery_size4_class5', 'optional', 4)
  ]

  const enriched = new CatalogueShipLoadoutEnricher(catalogue).enrich(ship)
  expect(enriched.definition?.displayName).toBe('Type-11 Prospector')
  expect(enriched.modules.map(module => ({
    slotId: module.slotId,
    observedSize: module.slotSize,
    expectedSize: module.expectedSlot?.size,
    expectedName: module.expectedSlot?.name,
    source: module.definition?.source.kind
  }))).toEqual([
    { slotId: 'PowerPlant', observedSize: 6, expectedSize: 6, expectedName: 'Power Plant', source: 'catalogue' },
    { slotId: 'LargeMiningHardpoint1', observedSize: 3, expectedSize: 3, expectedName: 'Mining', source: 'inferred' },
    { slotId: 'TinyHardpoint4', observedSize: null, expectedSize: 0, expectedName: undefined, source: 'catalogue' },
    { slotId: 'LimpetController01', observedSize: 5, expectedSize: 5, expectedName: 'Limpets', source: 'inferred' },
    { slotId: 'Slot06_Size4', observedSize: 4, expectedSize: 4, expectedName: undefined, source: 'catalogue' }
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
