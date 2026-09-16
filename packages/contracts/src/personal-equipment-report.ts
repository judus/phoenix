import { z } from 'zod'
import { PersonalEquipmentCatalogueSourceSchema, PersonalEquipmentRecipeIngredientSchema } from './personal-equipment-upgrades.js'
import { PersonalMaterialGroupIdSchema } from './personal-materials.js'

const EquipmentKindSchema = z.enum(['suit', 'weapon'])
const EquipmentGradeSchema = z.number().int().min(1).max(5)
const EquipmentInstanceIdSchema = z.number().int().nonnegative()

export const PersonalEquipmentReportResponseSchema = z.object({
  schemaVersion: z.literal(1),
  catalogueVersion: z.string().min(1),
  catalogueGeneratedAt: z.iso.datetime(),
  catalogueSources: z.array(PersonalEquipmentCatalogueSourceSchema).min(1),
  coverage: z.object({
    ownership: z.literal('observed'),
    equipmentUpdatedAt: z.iso.datetime().nullable(),
    materialsUpdatedAt: z.iso.datetime().nullable(),
    shipLockerUpdatedAt: z.iso.datetime().nullable(),
    backpackUpdatedAt: z.iso.datetime().nullable(),
    materialInventoryComplete: z.boolean()
  }).strict(),
  currentLoadoutId: EquipmentInstanceIdSchema.nullable(),
  loadouts: z.array(z.object({
    id: EquipmentInstanceIdSchema,
    name: z.string().min(1),
    current: z.boolean(),
    suitId: EquipmentInstanceIdSchema,
    weapons: z.array(z.object({
      slot: z.string().min(1),
      weaponId: EquipmentInstanceIdSchema
    }).strict())
  }).strict()),
  ownedEquipment: z.array(z.object({
    kind: EquipmentKindSchema,
    instanceId: EquipmentInstanceIdSchema,
    definitionId: z.string().min(1).nullable(),
    name: z.string().min(1),
    grade: EquipmentGradeSchema.nullable(),
    modificationSlots: z.object({
      total: z.number().int().min(0).max(4),
      installed: z.number().int().min(0),
      remaining: z.number().int().min(0).max(4)
    }).strict().nullable(),
    installedModifications: z.array(z.object({
      id: z.string().min(1).nullable(),
      symbol: z.string().min(1),
      name: z.string().min(1)
    }).strict()),
    loadoutIds: z.array(EquipmentInstanceIdSchema),
    manufacturer: z.string().min(1).nullable(),
    category: z.string().min(1).nullable(),
    damageType: z.string().min(1).nullable(),
    updatedAt: z.iso.datetime()
  }).strict()),
  materials: z.array(z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    group: PersonalMaterialGroupIdSchema,
    shipLocker: z.number().int().nonnegative().nullable(),
    backpack: z.number().int().nonnegative().nullable(),
    observedTotal: z.number().int().nonnegative(),
    missionTagged: z.number().int().nonnegative()
  }).strict()),
  equipmentDefinitions: z.array(z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    kind: EquipmentKindSchema,
    grades: z.array(z.object({
      grade: EquipmentGradeSchema,
      modificationSlots: z.number().int().min(0).max(4)
    }).strict()).min(1),
    compatibleModificationIds: z.array(z.string().min(1))
  }).strict()),
  gradeUpgradePaths: z.array(z.object({
    id: z.string().min(1),
    targetKind: EquipmentKindSchema,
    targetId: z.string().min(1),
    name: z.string().min(1),
    equipmentNames: z.array(z.string().min(1)).min(1),
    fromGrade: EquipmentGradeSchema,
    toGrade: EquipmentGradeSchema,
    steps: z.array(z.object({
      id: z.string().min(1),
      fromGrade: EquipmentGradeSchema,
      toGrade: EquipmentGradeSchema,
      modificationSlots: z.number().int().min(0).max(4),
      credits: z.number().int().nonnegative().nullable(),
      ingredients: z.array(PersonalEquipmentRecipeIngredientSchema).min(1)
    }).strict()).min(1)
  }).strict()),
  modifications: z.array(z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    targetKind: EquipmentKindSchema,
    engineeringTechnology: z.enum(['kinetic', 'laser', 'plasma']).nullable(),
    specialistIds: z.array(z.string().min(1)).min(1),
    credits: z.number().int().nonnegative().nullable(),
    ingredients: z.array(PersonalEquipmentRecipeIngredientSchema).min(1)
  }).strict()),
  specialists: z.array(z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    access: z.object({
      state: z.enum(['locked', 'known', 'invited', 'acquainted', 'unlocked', 'barred', 'unknown']),
      reportedStatus: z.string().min(1).nullable(),
      evidence: z.enum(['elite_journal', 'not_observed'])
    }).strict(),
    location: z.object({
      systemName: z.string().min(1),
      distanceLy: z.number().finite().nonnegative().nullable(),
      evidence: z.literal('external_catalogue')
    }).strict(),
    modificationIds: z.array(z.string().min(1)).min(1)
  }).strict()),
  unknowns: z.array(z.object({
    kind: z.enum(['equipment_definition', 'equipment_grade', 'installed_modification', 'inventory_snapshot']),
    reference: z.string().min(1),
    message: z.string().min(1)
  }).strict())
}).strict()

export type PersonalEquipmentReportResponse = z.infer<typeof PersonalEquipmentReportResponseSchema>
