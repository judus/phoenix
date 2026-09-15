import { z } from 'zod'
import { PersonalMaterialGroupIdSchema } from './personal-materials.js'

export const PersonalEquipmentCatalogueSourceSchema = z.object({
  name: z.string().min(1),
  repository: z.url(),
  revision: z.string().min(1),
  license: z.string().min(1),
  retrievedAt: z.iso.datetime()
}).strict()

export const PersonalEquipmentRecipeIngredientSchema = z.object({
  materialId: z.string().min(1),
  materialName: z.string().min(1),
  group: PersonalMaterialGroupIdSchema,
  count: z.number().int().positive()
}).strict()

export const PersonalEquipmentGradeUpgradeStepSchema = z.object({
  id: z.string().min(1),
  fromGrade: z.number().int().min(1).max(4),
  toGrade: z.number().int().min(2).max(5),
  resultingModificationSlots: z.number().int().min(1).max(4),
  credits: z.number().int().nonnegative().nullable(),
  ingredients: z.array(PersonalEquipmentRecipeIngredientSchema).min(1)
}).strict()

export const PersonalEquipmentGradeUpgradePathSchema = z.object({
  id: z.string().min(1),
  targetKind: z.enum(['suit', 'weapon']),
  targetId: z.string().min(1),
  name: z.string().min(1),
  equipmentNames: z.array(z.string().min(1)).min(1),
  fromGrade: z.number().int().min(1).max(4),
  toGrade: z.number().int().min(2).max(5),
  resultingModificationSlots: z.number().int().min(1).max(4),
  steps: z.array(PersonalEquipmentGradeUpgradeStepSchema).min(1)
}).strict()

export const PersonalEquipmentModificationViewSchema = z.object({
  id: z.string().min(1),
  journalSymbols: z.array(z.string().min(1)).min(1),
  name: z.string().min(1),
  targetKind: z.enum(['suit', 'weapon']),
  engineeringTechnology: z.enum(['kinetic', 'laser', 'plasma']).nullable(),
  engineers: z.array(z.string().min(1)).min(1),
  credits: z.number().int().nonnegative().nullable(),
  ingredients: z.array(PersonalEquipmentRecipeIngredientSchema).min(1)
}).strict()

export const PersonalEquipmentUpgradesResponseSchema = z.object({
  schemaVersion: z.literal(1),
  catalogueVersion: z.string().min(1),
  generatedAt: z.iso.datetime(),
  sources: z.array(PersonalEquipmentCatalogueSourceSchema).min(1),
  gradeUpgradePaths: z.array(PersonalEquipmentGradeUpgradePathSchema),
  modifications: z.array(PersonalEquipmentModificationViewSchema)
}).strict()

export type PersonalEquipmentRecipeIngredient = z.infer<typeof PersonalEquipmentRecipeIngredientSchema>
export type PersonalEquipmentGradeUpgradeStep = z.infer<typeof PersonalEquipmentGradeUpgradeStepSchema>
export type PersonalEquipmentGradeUpgradePath = z.infer<typeof PersonalEquipmentGradeUpgradePathSchema>
export type PersonalEquipmentModificationView = z.infer<typeof PersonalEquipmentModificationViewSchema>
export type PersonalEquipmentUpgradesResponse = z.infer<typeof PersonalEquipmentUpgradesResponseSchema>
