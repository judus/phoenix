import { expect, test } from 'vitest'
import {
  PERSONAL_EQUIPMENT_SOURCE,
  transformPersonalEquipmentCatalogue
} from '../scripts/catalogue/build-personal-equipment-catalogue.mjs'

test('keeps technology-specific weapon recipes distinct from their shared journal symbol', () => {
  const catalogue = transformPersonalEquipmentCatalogue(sourceDocuments(), '2026-09-15T00:00:00.000Z')
  const greaterRange = catalogue.modifications.find(modification => modification.id === 'weapon_range_kinetic')

  expect(catalogue.schemaVersion).toBe(2)
  expect(catalogue.engineers.find(engineer => engineer.displayName === 'Domino Green')).toEqual({
    displayName: 'Domino Green',
    frontierEngineerId: 400002,
    id: 'domino-green'
  })
  expect(greaterRange).toMatchObject({
    engineerIds: ['domino-green'],
    engineeringTechnology: 'kinetic',
    journalSymbols: ['weapon_range'],
    targetKind: 'weapon'
  })
})

test('produces the audited Maverick and Karma P-15 cumulative material plans', () => {
  const catalogue = transformPersonalEquipmentCatalogue(sourceDocuments(), '2026-09-15T00:00:00.000Z')

  expect(totals(catalogue.gradeUpgradeRecipes.filter(recipe => recipe.targetId === 'utilitysuit'))).toEqual({
    carbonfibreplating: 28,
    graphene: 28,
    healthmonitor: 12,
    manufacturinginstructions: 12,
    suitschematic: 12
  })
  expect(totals([
    ...catalogue.gradeUpgradeRecipes.filter(recipe => recipe.targetId === 'karma'),
    catalogue.modifications.find(modification => modification.id === 'weapon_range_kinetic')
  ])).toEqual({
    ballisticsdata: 10,
    compressionliquefiedgas: 12,
    manufacturinginstructions: 12,
    metalcoil: 10,
    rdx: 10,
    topographicalsurveys: 10,
    tungstencarbide: 28,
    weaponcomponent: 33,
    weaponschematic: 12
  })
})

test('rejects a recipe that references an unknown micro resource', () => {
  const documents = sourceDocuments()
  const costs = JSON.parse(documents['data/equipment/modification-costs.jsonc'])
  costs.weapon_range_kinetic[0].symbol = 'not_registered'
  documents['data/equipment/modification-costs.jsonc'] = JSON.stringify(costs)

  expect(() => transformPersonalEquipmentCatalogue(documents, '2026-09-15T00:00:00.000Z'))
    .toThrow('references unknown micro resource not_registered')
})

function sourceDocuments () {
  const resources = [
    'suitschematic', 'healthmonitor', 'manufacturinginstructions', 'carbonfibreplating', 'graphene',
    'weaponschematic', 'compressionliquefiedgas', 'tungstencarbide', 'weaponcomponent',
    'ballisticsdata', 'topographicalsurveys', 'metalcoil', 'rdx'
  ].map(symbol => ({ symbol, name: displayName(symbol) }))
  const documents = Object.fromEntries(PERSONAL_EQUIPMENT_SOURCE.paths.map(path => [path, JSON.stringify(path.includes('micro-resources-') ? [] : {})]))
  documents['data/materials/micro-resources-item.jsonc'] = JSON.stringify(resources)
  documents['data/equipment/suits.jsonc'] = JSON.stringify([{
    family: 'utilitysuit',
    name: 'Maverick Suit',
    grades: grades(grade => `utilitysuit_class${grade}`)
  }])
  documents['data/equipment/weapons.jsonc'] = JSON.stringify([{
    symbol: 'wpn_s_pistol_kinetic_sauto',
    name: 'Karma P-15',
    upgradeGroup: 'karma',
    engineeringType: 'kinetic',
    grades: grades()
  }])
  documents['data/equipment/upgrade-costs.jsonc'] = JSON.stringify({
    suits: {
      utilitysuit: upgradeSteps(['suitschematic', 'healthmonitor', 'manufacturinginstructions'], ['carbonfibreplating', 'graphene'])
    },
    weaponGroups: {
      karma: upgradeSteps(['weaponschematic', 'compressionliquefiedgas', 'manufacturinginstructions'], ['tungstencarbide', 'weaponcomponent'])
    }
  })
  documents['data/equipment/modifications.jsonc'] = JSON.stringify({
    weapon_range_kinetic: {
      name: 'Greater Range',
      target: 'weapon',
      engineers: ['Domino Green'],
      modifiers: []
    }
  })
  documents['data/equipment/modification-costs.jsonc'] = JSON.stringify({
    weapon_range_kinetic: ingredients([
      ['ballisticsdata', 10],
      ['topographicalsurveys', 10],
      ['metalcoil', 10],
      ['rdx', 10],
      ['weaponcomponent', 5]
    ])
  })
  documents['data/equipment/modification-journal-names.jsonc'] = JSON.stringify({
    weapon_range_kinetic: 'weapon_range'
  })
  return documents
}

function grades (symbol) {
  return Object.fromEntries([1, 2, 3, 4, 5].map(grade => [grade, {
    ...(symbol ? { symbol: symbol(grade) } : {}),
    modificationSlots: grade - 1
  }]))
}

function upgradeSteps (standardMaterials, largeMaterials) {
  const standardCounts = [1, 2, 4, 5]
  const largeCounts = [2, 5, 9, 12]
  return Object.fromEntries([2, 3, 4, 5].map((grade, index) => [grade, ingredients([
    ...standardMaterials.map(symbol => [symbol, standardCounts[index]]),
    ...largeMaterials.map(symbol => [symbol, largeCounts[index]])
  ])]))
}

function ingredients (values) {
  return values.map(([symbol, count]) => ({ symbol, count }))
}

function totals (recipes) {
  const result = {}
  for (const recipe of recipes) for (const ingredient of recipe.ingredients) {
    result[ingredient.materialId] = (result[ingredient.materialId] ?? 0) + ingredient.count
  }
  return Object.fromEntries(Object.entries(result).sort(([left], [right]) => left.localeCompare(right)))
}

function displayName (value) {
  return value.replace(/([a-z])([A-Z])/gu, '$1 $2').replace(/\b\w/gu, letter => letter.toLocaleUpperCase())
}
