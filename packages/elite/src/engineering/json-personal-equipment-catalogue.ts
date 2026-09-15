import { readFileSync } from 'node:fs'
import { z } from 'zod'

const PersonalEquipmentSourceSchema = z.object({
  name: z.string().min(1),
  repository: z.url(),
  revision: z.string().regex(/^[a-f0-9]{40}$/u),
  license: z.string().min(1),
  paths: z.array(z.string().min(1)).min(1),
  retrievedAt: z.iso.datetime()
}).strict()

const PersonalEquipmentGradeSchema = z.object({
  grade: z.number().int().min(1).max(5),
  modificationSlots: z.number().int().min(0).max(4)
}).strict()

const PersonalEquipmentDefinitionSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['suit', 'weapon']),
  displayName: z.string().min(1),
  frontierSymbols: z.array(z.string().min(1)).min(1),
  upgradeFamilyId: z.string().min(1),
  engineeringTechnology: z.string().min(1).nullable(),
  grades: z.array(PersonalEquipmentGradeSchema).min(1)
}).strict()

const PersonalEquipmentIngredientSchema = z.object({
  materialId: z.string().min(1),
  count: z.number().int().positive()
}).strict()

const PersonalEquipmentGradeUpgradeRecipeSchema = z.object({
  id: z.string().min(1),
  targetKind: z.enum(['suit', 'weapon']),
  targetId: z.string().min(1),
  fromGrade: z.number().int().min(1).max(4),
  toGrade: z.number().int().min(2).max(5),
  resultingModificationSlots: z.number().int().min(1).max(4),
  credits: z.number().int().nonnegative().nullable(),
  ingredients: z.array(PersonalEquipmentIngredientSchema).min(1)
}).strict()

const PersonalEquipmentModificationSchema = z.object({
  id: z.string().min(1),
  journalSymbols: z.array(z.string().min(1)).min(1),
  displayName: z.string().min(1),
  targetKind: z.enum(['suit', 'weapon']),
  engineeringTechnology: z.enum(['kinetic', 'laser', 'plasma']).nullable(),
  engineers: z.array(z.string().min(1)).min(1),
  credits: z.number().int().nonnegative().nullable(),
  ingredients: z.array(PersonalEquipmentIngredientSchema).min(1)
}).strict()

const PersonalEquipmentMicroResourceSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1),
  journalBucket: z.enum(['item', 'component', 'data', 'consumable']),
  playerGroup: z.enum(['goods', 'assets', 'data', 'consumables'])
}).strict()

const PersonalEquipmentCatalogueSnapshotSchema = z.object({
  schemaVersion: z.literal(1),
  catalogueVersion: z.string().min(1),
  generatedAt: z.iso.datetime(),
  sources: z.array(PersonalEquipmentSourceSchema).min(1),
  equipmentDefinitions: z.array(PersonalEquipmentDefinitionSchema).min(1),
  gradeUpgradeRecipes: z.array(PersonalEquipmentGradeUpgradeRecipeSchema).min(1),
  modifications: z.array(PersonalEquipmentModificationSchema).min(1),
  microResources: z.array(PersonalEquipmentMicroResourceSchema).min(1)
}).strict()

export type PersonalEquipmentCatalogueSource = z.infer<typeof PersonalEquipmentSourceSchema>
export type PersonalEquipmentDefinition = z.infer<typeof PersonalEquipmentDefinitionSchema>
export type PersonalEquipmentGradeUpgradeRecipe = z.infer<typeof PersonalEquipmentGradeUpgradeRecipeSchema>
export type PersonalEquipmentModification = z.infer<typeof PersonalEquipmentModificationSchema>
export type PersonalEquipmentMicroResource = z.infer<typeof PersonalEquipmentMicroResourceSchema>
export type PersonalEquipmentCatalogueSnapshot = z.infer<typeof PersonalEquipmentCatalogueSnapshotSchema>

export interface PersonalEquipmentCatalogue {
  getSnapshot(): PersonalEquipmentCatalogueSnapshot
}

export class JsonPersonalEquipmentCatalogue implements PersonalEquipmentCatalogue {
  private snapshot: PersonalEquipmentCatalogueSnapshot | null = null

  public constructor (private readonly path: string) {}

  public getSnapshot (): PersonalEquipmentCatalogueSnapshot {
    this.snapshot ??= PersonalEquipmentCatalogueSnapshotSchema.parse(
      JSON.parse(readFileSync(this.path, 'utf8')) as unknown
    )
    return structuredClone(this.snapshot)
  }
}
