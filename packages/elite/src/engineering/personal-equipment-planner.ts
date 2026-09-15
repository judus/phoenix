import type {
  PersonalEquipmentCatalogueSnapshot,
  PersonalEquipmentGradeUpgradeRecipe,
  PersonalEquipmentModification
} from './json-personal-equipment-catalogue.js'

export interface PersonalEquipmentPlanInput {
  equipmentId: string
  currentGrade: number
  targetGrade: number
  installedModificationIds: string[]
  installedModificationCount: number
  plannedModificationIds: string[]
}

export interface PersonalEquipmentPlanStep {
  id: string
  kind: 'grade_upgrade' | 'install_modification'
  name: string
  credits: number | null
  ingredients: Array<{ materialId: string, count: number }>
  fromGrade?: number
  toGrade?: number
  modificationId?: string
  engineerIds?: string[]
}

export interface PersonalEquipmentPlan {
  catalogueVersion: string
  equipment: { id: string, name: string, kind: 'suit' | 'weapon' }
  currentGrade: number
  targetGrade: number
  slots: { current: number, target: number, installed: number, planned: number, remaining: number }
  steps: PersonalEquipmentPlanStep[]
  materials: Array<{ materialId: string, count: number }>
  credits: { knownSubtotal: number, total: number | null, complete: boolean }
  specialistIds: string[]
}

export class PersonalEquipmentPlanningError extends Error {
  public constructor (message: string) {
    super(message)
    this.name = 'PersonalEquipmentPlanningError'
  }
}

export function planPersonalEquipmentUpgrade (
  catalogue: PersonalEquipmentCatalogueSnapshot,
  input: PersonalEquipmentPlanInput
): PersonalEquipmentPlan {
  const definition = catalogue.equipmentDefinitions.find(candidate => candidate.id === input.equipmentId)
  if (!definition) fail(`Unknown personal equipment ${input.equipmentId}.`)
  const current = definition.grades.find(grade => grade.grade === input.currentGrade)
  const target = definition.grades.find(grade => grade.grade === input.targetGrade)
  if (!current) fail(`${definition.displayName} does not support grade ${input.currentGrade}.`)
  if (!target) fail(`${definition.displayName} does not support grade ${input.targetGrade}.`)
  if (input.targetGrade < input.currentGrade) fail('Target grade cannot be lower than the current grade.')
  if (!Number.isInteger(input.installedModificationCount) || input.installedModificationCount < 0) {
    fail('Installed modification count must be a non-negative integer.')
  }
  assertUnique(input.installedModificationIds, 'installed modifications')
  assertUnique(input.plannedModificationIds, 'planned modifications')
  if (input.installedModificationCount < input.installedModificationIds.length) {
    fail('Installed modification count cannot be lower than the number of resolved installed modifications.')
  }
  const installed = new Set(input.installedModificationIds)
  const planned = input.plannedModificationIds.map(id => modification(catalogue, id))
  for (const candidate of planned) {
    if (installed.has(candidate.id)) fail(`${candidate.displayName} is already installed.`)
    if (!candidate.compatibleEquipmentIds.includes(definition.id)) {
      fail(`${candidate.displayName} is not compatible with ${definition.displayName}.`)
    }
  }
  const occupiedSlots = input.installedModificationCount + planned.length
  if (occupiedSlots > target.modificationSlots) {
    fail(`${definition.displayName} grade ${target.grade} has ${target.modificationSlots} modification slots, but ${occupiedSlots} would be occupied.`)
  }

  const gradeRecipes = gradeSteps(catalogue, definition.kind, definition.upgradeFamilyId, input.currentGrade, input.targetGrade)
  const steps: PersonalEquipmentPlanStep[] = [
    ...gradeRecipes.map(recipe => ({
      id: recipe.id,
      kind: 'grade_upgrade' as const,
      name: `Grade ${recipe.fromGrade} to ${recipe.toGrade}`,
      credits: recipe.credits,
      ingredients: recipe.ingredients,
      fromGrade: recipe.fromGrade,
      toGrade: recipe.toGrade
    })),
    ...planned.map(candidate => ({
      id: `modification:${candidate.id}`,
      kind: 'install_modification' as const,
      name: candidate.displayName,
      credits: candidate.credits,
      ingredients: candidate.ingredients,
      modificationId: candidate.id,
      engineerIds: candidate.engineerIds
    }))
  ]
  const materialTotals = new Map<string, number>()
  for (const step of steps) for (const ingredient of step.ingredients) {
    materialTotals.set(ingredient.materialId, (materialTotals.get(ingredient.materialId) ?? 0) + ingredient.count)
  }
  const knownSubtotal = steps.reduce((sum, step) => sum + (step.credits ?? 0), 0)
  const complete = steps.every(step => step.credits !== null)
  return {
    catalogueVersion: catalogue.catalogueVersion,
    equipment: { id: definition.id, name: definition.displayName, kind: definition.kind },
    currentGrade: input.currentGrade,
    targetGrade: input.targetGrade,
    slots: {
      current: current.modificationSlots,
      target: target.modificationSlots,
      installed: input.installedModificationCount,
      planned: planned.length,
      remaining: target.modificationSlots - occupiedSlots
    },
    steps,
    materials: [...materialTotals].map(([materialId, count]) => ({ materialId, count }))
      .sort((left, right) => left.materialId.localeCompare(right.materialId)),
    credits: { knownSubtotal, total: complete ? knownSubtotal : null, complete },
    specialistIds: [...new Set(planned.flatMap(candidate => candidate.engineerIds))].sort()
  }
}

function gradeSteps (
  catalogue: PersonalEquipmentCatalogueSnapshot,
  targetKind: 'suit' | 'weapon',
  targetId: string,
  currentGrade: number,
  targetGrade: number
): PersonalEquipmentGradeUpgradeRecipe[] {
  const recipes: PersonalEquipmentGradeUpgradeRecipe[] = []
  for (let fromGrade = currentGrade; fromGrade < targetGrade; fromGrade += 1) {
    const recipe = catalogue.gradeUpgradeRecipes.find(candidate => (
      candidate.targetKind === targetKind &&
      candidate.targetId === targetId &&
      candidate.fromGrade === fromGrade &&
      candidate.toGrade === fromGrade + 1
    ))
    if (!recipe) fail(`No ${targetKind} upgrade recipe exists for ${targetId} grade ${fromGrade} to ${fromGrade + 1}.`)
    recipes.push(recipe)
  }
  return recipes
}

function modification (catalogue: PersonalEquipmentCatalogueSnapshot, id: string): PersonalEquipmentModification {
  const result = catalogue.modifications.find(candidate => candidate.id === id)
  if (!result) fail(`Unknown personal equipment modification ${id}.`)
  return result
}

function assertUnique (values: string[], label: string): void {
  if (new Set(values).size !== values.length) fail(`Duplicate ${label} are not allowed.`)
}

function fail (message: string): never {
  throw new PersonalEquipmentPlanningError(message)
}
