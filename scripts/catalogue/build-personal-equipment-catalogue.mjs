import { parse, printParseErrorCode } from 'jsonc-parser'

export const PERSONAL_EQUIPMENT_SOURCE = Object.freeze({
  name: 'Elite Dangerous Almanac',
  repository: 'https://github.com/DarkSession/Elite-Dangerous-Almanac',
  revision: '362210e98b334cd7575d0734301c66c8bd2d17bd',
  license: 'AGPL-3.0-or-later',
  paths: Object.freeze([
    'data/equipment/suits.jsonc',
    'data/equipment/weapons.jsonc',
    'data/equipment/modifications.jsonc',
    'data/equipment/modification-costs.jsonc',
    'data/equipment/modification-journal-names.jsonc',
    'data/equipment/upgrade-costs.jsonc',
    'data/materials/micro-resources-item.jsonc',
    'data/materials/micro-resources-component.jsonc',
    'data/materials/micro-resources-data.jsonc',
    'data/materials/micro-resources-consumable.jsonc'
  ])
})

const RESOURCE_FILES = [
  ['data/materials/micro-resources-item.jsonc', 'item', 'goods'],
  ['data/materials/micro-resources-component.jsonc', 'component', 'assets'],
  ['data/materials/micro-resources-data.jsonc', 'data', 'data'],
  ['data/materials/micro-resources-consumable.jsonc', 'consumable', 'consumables']
]

export function buildPersonalEquipmentCatalogue (sourceDocuments, generatedAt) {
  const catalogue = transformPersonalEquipmentCatalogue(sourceDocuments, generatedAt)
  validateRevisionInvariants(catalogue)
  return catalogue
}

export function transformPersonalEquipmentCatalogue (sourceDocuments, generatedAt) {
  const documents = Object.fromEntries(PERSONAL_EQUIPMENT_SOURCE.paths.map(path => [
    path,
    parseDocument(requiredDocument(sourceDocuments, path), path)
  ]))
  const microResources = RESOURCE_FILES.flatMap(([path, journalBucket, playerGroup]) => (
    requiredArray(documents[path], path).map((record, index) => ({
      id: requiredString(record, 'symbol', `${path}[${index}]`),
      displayName: requiredString(record, 'name', `${path}[${index}]`),
      journalBucket,
      playerGroup
    }))
  ))
  const resources = uniqueMap(microResources, 'id', 'micro-resource')
  const suits = requiredArray(documents['data/equipment/suits.jsonc'], 'suits')
  const weapons = requiredArray(documents['data/equipment/weapons.jsonc'], 'weapons')
  const equipmentDefinitions = [
    ...suits.map((record, index) => equipmentDefinition(record, index, 'suit')),
    ...weapons.map((record, index) => equipmentDefinition(record, index, 'weapon'))
  ]
  const definitions = uniqueMap(equipmentDefinitions, 'id', 'equipment definition')
  const upgradeCosts = requiredObject(documents['data/equipment/upgrade-costs.jsonc'], 'upgrade costs')
  const gradeUpgradeRecipes = [
    ...buildGradeUpgradeRecipes('suit', requiredObject(upgradeCosts.suits, 'upgrade costs.suits'), definitions, resources),
    ...buildGradeUpgradeRecipes('weapon', requiredObject(upgradeCosts.weaponGroups, 'upgrade costs.weaponGroups'), definitions, resources)
  ]
  const modificationRecords = requiredObject(documents['data/equipment/modifications.jsonc'], 'modifications')
  const modificationCosts = requiredObject(documents['data/equipment/modification-costs.jsonc'], 'modification costs')
  const journalNames = requiredObject(documents['data/equipment/modification-journal-names.jsonc'], 'modification journal names')
  const modifications = Object.entries(modificationRecords).map(([id, value]) => {
    const record = requiredObject(value, `modification ${id}`)
    const targetKind = requiredEnum(record.target, ['suit', 'weapon'], `modification ${id}.target`)
    const journalSymbol = journalNames[id] === undefined
      ? id
      : requiredStringValue(journalNames[id], `modification journal name ${id}`)
    const engineeringTechnology = journalSymbol === id ? null : technologySuffix(id)
    if (journalSymbol !== id && targetKind !== 'weapon') throw new Error(`Non-weapon modification ${id} has an ambiguous journal symbol.`)
    return {
      id,
      journalSymbols: [journalSymbol],
      displayName: requiredString(record, 'name', `modification ${id}`),
      targetKind,
      engineeringTechnology,
      engineers: requiredArray(record.engineers, `modification ${id}.engineers`)
        .map((name, index) => requiredStringValue(name, `modification ${id}.engineers[${index}]`)),
      credits: null,
      ingredients: ingredients(modificationCosts[id], `modification cost ${id}`, resources)
    }
  }).sort((left, right) => left.displayName.localeCompare(right.displayName) || left.id.localeCompare(right.id))

  for (const id of Object.keys(modificationCosts)) {
    if (modificationRecords[id] === undefined) throw new Error(`Modification costs reference unknown modification ${id}.`)
  }
  for (const id of Object.keys(journalNames)) {
    if (modificationRecords[id] === undefined) throw new Error(`Journal symbol map references unknown modification ${id}.`)
  }

  const catalogue = {
    schemaVersion: 1,
    catalogueVersion: PERSONAL_EQUIPMENT_SOURCE.revision,
    generatedAt,
    sources: [{
      ...PERSONAL_EQUIPMENT_SOURCE,
      paths: [...PERSONAL_EQUIPMENT_SOURCE.paths],
      retrievedAt: generatedAt
    }],
    equipmentDefinitions: equipmentDefinitions.sort((left, right) => left.displayName.localeCompare(right.displayName)),
    gradeUpgradeRecipes: gradeUpgradeRecipes.sort((left, right) => left.targetKind.localeCompare(right.targetKind) || left.targetId.localeCompare(right.targetId) || left.toGrade - right.toGrade),
    modifications,
    microResources: microResources.sort((left, right) => left.displayName.localeCompare(right.displayName))
  }
  return catalogue
}

function equipmentDefinition (value, index, kind) {
  const record = requiredObject(value, `${kind}[${index}]`)
  const grades = requiredObject(record.grades, `${kind}[${index}].grades`)
  const id = kind === 'suit'
    ? requiredString(record, 'family', `${kind}[${index}]`)
    : requiredString(record, 'symbol', `${kind}[${index}]`)
  const upgradeFamilyId = kind === 'suit'
    ? id
    : requiredString(record, 'upgradeGroup', `${kind}[${index}]`)
  const gradeRecords = Object.entries(grades).map(([grade, gradeValue]) => {
    const parsedGrade = positiveInteger(Number(grade), `${kind} ${id} grade`)
    const detail = requiredObject(gradeValue, `${kind} ${id} grade ${parsedGrade}`)
    return {
      grade: parsedGrade,
      modificationSlots: nonnegativeInteger(detail.modificationSlots, `${kind} ${id} grade ${parsedGrade}.modificationSlots`),
      frontierSymbol: kind === 'suit'
        ? requiredString(detail, 'symbol', `${kind} ${id} grade ${parsedGrade}`)
        : id
    }
  }).sort((left, right) => left.grade - right.grade)
  return {
    id,
    kind,
    displayName: requiredString(record, 'name', `${kind}[${index}]`),
    frontierSymbols: [...new Set(gradeRecords.map(grade => grade.frontierSymbol))],
    upgradeFamilyId,
    engineeringTechnology: kind === 'weapon'
      ? requiredString(record, 'engineeringType', `${kind}[${index}]`)
      : null,
    grades: gradeRecords.map(({ grade, modificationSlots }) => ({ grade, modificationSlots }))
  }
}

function buildGradeUpgradeRecipes (targetKind, targets, definitions, resources) {
  return Object.entries(targets).flatMap(([targetId, value]) => {
    const matching = [...definitions.values()].filter(definition => (
      definition.kind === targetKind && definition.upgradeFamilyId === targetId
    ))
    if (matching.length === 0) throw new Error(`Upgrade costs reference unknown ${targetKind} target ${targetId}.`)
    return Object.entries(requiredObject(value, `${targetKind} upgrade ${targetId}`)).map(([targetGrade, cost]) => {
      const toGrade = positiveInteger(Number(targetGrade), `${targetKind} upgrade ${targetId} target grade`)
      const slots = [...new Set(matching.map(definition => (
        definition.grades.find(grade => grade.grade === toGrade)?.modificationSlots
      )))]
      if (slots.length !== 1 || slots[0] === undefined) {
        throw new Error(`${targetKind} upgrade ${targetId} grade ${toGrade} has inconsistent modification slots.`)
      }
      return {
        id: `grade:${targetKind}:${targetId}:${toGrade - 1}-${toGrade}`,
        targetKind,
        targetId,
        fromGrade: toGrade - 1,
        toGrade,
        resultingModificationSlots: slots[0],
        credits: null,
        ingredients: ingredients(cost, `${targetKind} upgrade ${targetId} grade ${toGrade}`, resources)
      }
    })
  })
}

function ingredients (value, context, resources) {
  return requiredArray(value, context).map((ingredient, index) => {
    const record = requiredObject(ingredient, `${context}[${index}]`)
    const materialId = requiredString(record, 'symbol', `${context}[${index}]`)
    if (!resources.has(materialId)) throw new Error(`${context} references unknown micro resource ${materialId}.`)
    return {
      materialId,
      count: positiveInteger(record.count, `${context}[${index}].count`)
    }
  })
}

function validateRevisionInvariants (catalogue) {
  const suits = catalogue.equipmentDefinitions.filter(definition => definition.kind === 'suit')
  const weapons = catalogue.equipmentDefinitions.filter(definition => definition.kind === 'weapon')
  const suitModifications = catalogue.modifications.filter(modification => modification.targetKind === 'suit')
  const weaponModifications = catalogue.modifications.filter(modification => modification.targetKind === 'weapon')
  const ambiguousJournalSymbols = catalogue.modifications.filter(modification => modification.engineeringTechnology !== null)
  const checks = [
    [suits.length, 4, 'suit definitions'],
    [weapons.length, 11, 'weapon definitions'],
    [catalogue.gradeUpgradeRecipes.length, 24, 'grade upgrade recipes'],
    [suitModifications.length, 14, 'suit modifications'],
    [weaponModifications.length, 17, 'weapon modifications'],
    [ambiguousJournalSymbols.length, 9, 'technology-specific journal-symbol mappings'],
    [catalogue.microResources.length, 226, 'micro resources']
  ]
  for (const [actual, expected, label] of checks) {
    if (actual !== expected) throw new Error(`Pinned personal-equipment revision has ${actual} ${label}; expected ${expected}.`)
  }
}

function technologySuffix (id) {
  const match = id.match(/_(kinetic|laser|plasma)$/u)
  if (!match) throw new Error(`Ambiguous modification ${id} does not identify its engineering technology.`)
  return match[1]
}

function parseDocument (source, path) {
  const errors = []
  const result = parse(source, errors, { allowTrailingComma: true, disallowComments: false })
  if (errors.length > 0) {
    const first = errors[0]
    throw new Error(`Invalid JSONC in ${path} at offset ${first.offset}: ${printParseErrorCode(first.error)}.`)
  }
  return result
}

function requiredDocument (documents, path) {
  const source = documents[path]
  if (typeof source !== 'string' || source.length === 0) throw new Error(`Missing personal-equipment source document ${path}.`)
  return source
}

function requiredArray (value, context) {
  if (!Array.isArray(value)) throw new Error(`${context} must be an array.`)
  return value
}

function requiredObject (value, context) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${context} must be an object.`)
  return value
}

function requiredString (record, key, context) {
  return requiredStringValue(record[key], `${context}.${key}`)
}

function requiredStringValue (value, context) {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`${context} must be a non-empty string.`)
  return value.trim()
}

function requiredEnum (value, allowed, context) {
  if (!allowed.includes(value)) throw new Error(`${context} must be one of ${allowed.join(', ')}.`)
  return value
}

function positiveInteger (value, context) {
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${context} must be a positive integer.`)
  return value
}

function nonnegativeInteger (value, context) {
  if (!Number.isInteger(value) || value < 0) throw new Error(`${context} must be a non-negative integer.`)
  return value
}

function uniqueMap (values, key, label) {
  const result = new Map()
  for (const value of values) {
    const id = value[key]
    if (result.has(id)) throw new Error(`Duplicate ${label} ${id}.`)
    result.set(id, value)
  }
  return result
}
