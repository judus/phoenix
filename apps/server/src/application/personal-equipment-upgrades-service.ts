import {
  PersonalEquipmentUpgradesResponseSchema,
  type PersonalEquipmentGradeUpgradePath,
  type PersonalEquipmentRecipeIngredient,
  type PersonalEquipmentUpgradesResponse
} from '@phoenix/contracts'
import type {
  PersonalEquipmentCatalogue,
  PersonalEquipmentCatalogueSnapshot,
  PersonalEquipmentGradeUpgradeRecipe
} from '@phoenix/elite'
import type { PersonalEquipmentUpgradesReader } from '../domain/personal-equipment-upgrades.js'

export class PersonalEquipmentUpgradesService implements PersonalEquipmentUpgradesReader {
  public constructor (private readonly catalogue: PersonalEquipmentCatalogue) {}

  public getUpgrades (): PersonalEquipmentUpgradesResponse {
    const catalogue = this.catalogue.getSnapshot()
    const resources = new Map(catalogue.microResources.map(resource => [resource.id, resource] as const))
    return PersonalEquipmentUpgradesResponseSchema.parse({
      schemaVersion: 1,
      catalogueVersion: catalogue.catalogueVersion,
      generatedAt: catalogue.generatedAt,
      sources: catalogue.sources.map(source => ({
        name: source.name,
        repository: source.repository,
        revision: source.revision,
        license: source.license,
        retrievedAt: source.retrievedAt
      })),
      gradeUpgradePaths: gradeUpgradePaths(catalogue, ingredient => ingredientView(ingredient, resources)),
      modifications: catalogue.modifications.map(modification => ({
        id: modification.id,
        journalSymbols: modification.journalSymbols,
        name: modification.displayName,
        targetKind: modification.targetKind,
        engineeringTechnology: modification.engineeringTechnology,
        engineers: modification.engineers,
        credits: modification.credits,
        ingredients: modification.ingredients.map(ingredient => ingredientView(ingredient, resources))
      }))
    })
  }
}

function gradeUpgradePaths (
  catalogue: PersonalEquipmentCatalogueSnapshot,
  mapIngredient: (ingredient: PersonalEquipmentGradeUpgradeRecipe['ingredients'][number]) => PersonalEquipmentRecipeIngredient
): PersonalEquipmentGradeUpgradePath[] {
  const groups = new Map<string, PersonalEquipmentGradeUpgradeRecipe[]>()
  for (const recipe of catalogue.gradeUpgradeRecipes) {
    const key = `${recipe.targetKind}:${recipe.targetId}`
    groups.set(key, [...(groups.get(key) ?? []), recipe])
  }
  return [...groups.values()].map(recipes => {
    const sorted = recipes.toSorted((left, right) => left.fromGrade - right.fromGrade)
    const first = sorted[0]
    const last = sorted.at(-1)
    if (!first || !last) throw new Error('Personal-equipment upgrade path is empty.')
    const definitions = catalogue.equipmentDefinitions.filter(definition => (
      definition.kind === first.targetKind && definition.upgradeFamilyId === first.targetId
    ))
    if (definitions.length === 0) throw new Error(`Personal-equipment upgrade target ${first.targetId} has no equipment definitions.`)
    for (let index = 1; index < sorted.length; index += 1) {
      if (sorted[index]?.fromGrade !== sorted[index - 1]?.toGrade) {
        throw new Error(`Personal-equipment upgrade path ${first.targetId} is not contiguous.`)
      }
    }
    return {
      id: `grade:${first.targetKind}:${first.targetId}`,
      targetKind: first.targetKind,
      targetId: first.targetId,
      name: first.targetKind === 'suit' ? definitions[0]!.displayName : `${titleCase(first.targetId)} weapons`,
      equipmentNames: definitions.map(definition => definition.displayName).toSorted(),
      fromGrade: first.fromGrade,
      toGrade: last.toGrade,
      resultingModificationSlots: last.resultingModificationSlots,
      steps: sorted.map(recipe => ({
        id: recipe.id,
        fromGrade: recipe.fromGrade,
        toGrade: recipe.toGrade,
        resultingModificationSlots: recipe.resultingModificationSlots,
        credits: recipe.credits,
        ingredients: recipe.ingredients.map(mapIngredient)
      }))
    }
  }).sort((left, right) => left.targetKind.localeCompare(right.targetKind) || left.name.localeCompare(right.name))
}

function ingredientView (
  ingredient: PersonalEquipmentGradeUpgradeRecipe['ingredients'][number],
  resources: Map<string, PersonalEquipmentCatalogueSnapshot['microResources'][number]>
): PersonalEquipmentRecipeIngredient {
  const material = resources.get(ingredient.materialId)
  if (!material) throw new Error(`Personal-equipment recipe references unknown micro resource ${ingredient.materialId}.`)
  return {
    materialId: material.id,
    materialName: material.displayName,
    group: material.playerGroup,
    count: ingredient.count
  }
}

function titleCase (value: string): string {
  return value.replace(/(^|[_-])([a-z])/gu, (_, separator: string, letter: string) => `${separator ? ' ' : ''}${letter.toLocaleUpperCase()}`)
}
