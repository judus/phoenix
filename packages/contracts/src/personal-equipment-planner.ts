import { z } from 'zod'
import { PersonalMaterialGroupIdSchema } from './personal-materials.js'

const EquipmentKindSchema = z.enum(['suit', 'weapon'])
const GradeSchema = z.number().int().min(1).max(5)

export const PersonalEquipmentPlannerModificationSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  engineers: z.array(z.string().min(1)).min(1)
}).strict()

export const PersonalEquipmentPlannerInstalledModificationSchema = z.object({
  id: z.string().min(1).nullable(),
  symbol: z.string().min(1),
  name: z.string().min(1)
}).strict()

export const PersonalEquipmentPlannerObservedInstanceSchema = z.object({
  instanceId: z.number().int().nonnegative(),
  name: z.string().min(1),
  grade: GradeSchema,
  installedModifications: z.array(PersonalEquipmentPlannerInstalledModificationSchema)
}).strict()

export const PersonalEquipmentPlannerEquipmentSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  kind: EquipmentKindSchema,
  grades: z.array(z.object({
    grade: GradeSchema,
    modificationSlots: z.number().int().min(0).max(4)
  }).strict()).min(1),
  observedInstances: z.array(PersonalEquipmentPlannerObservedInstanceSchema),
  modifications: z.array(PersonalEquipmentPlannerModificationSchema)
}).strict()

export const PersonalEquipmentPlannerOptionsResponseSchema = z.object({
  schemaVersion: z.literal(1),
  catalogueVersion: z.string().min(1),
  generatedAt: z.iso.datetime(),
  equipment: z.array(PersonalEquipmentPlannerEquipmentSchema)
}).strict()

export const PersonalEquipmentPlannerSourceSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('observed'),
    equipmentKind: EquipmentKindSchema,
    instanceId: z.number().int().nonnegative()
  }).strict(),
  z.object({
    kind: z.literal('catalogue'),
    equipmentId: z.string().min(1),
    currentGrade: GradeSchema
  }).strict()
])

export const PersonalEquipmentPlanPreviewRequestSchema = z.object({
  source: PersonalEquipmentPlannerSourceSchema,
  targetGrade: GradeSchema,
  plannedModificationIds: z.array(z.string().min(1))
}).strict()

export const PersonalEquipmentPlanPreviewStepSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['grade_upgrade', 'install_modification']),
  name: z.string().min(1),
  credits: z.number().int().nonnegative().nullable(),
  ingredients: z.array(z.object({
    materialId: z.string().min(1),
    materialName: z.string().min(1),
    count: z.number().int().positive()
  }).strict()).min(1)
}).strict()

export const PersonalEquipmentPlanPreviewResponseSchema = z.object({
  schemaVersion: z.literal(1),
  catalogueVersion: z.string().min(1),
  equipment: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    kind: EquipmentKindSchema,
    source: z.enum(['observed', 'catalogue'])
  }).strict(),
  currentGrade: GradeSchema,
  targetGrade: GradeSchema,
  slots: z.object({
    current: z.number().int().min(0).max(4),
    target: z.number().int().min(0).max(4),
    installed: z.number().int().min(0).max(4),
    planned: z.number().int().min(0).max(4),
    remaining: z.number().int().min(0).max(4)
  }).strict(),
  steps: z.array(PersonalEquipmentPlanPreviewStepSchema),
  materials: z.array(z.object({
    materialId: z.string().min(1),
    materialName: z.string().min(1),
    group: PersonalMaterialGroupIdSchema,
    required: z.number().int().positive(),
    owned: z.number().int().nonnegative(),
    missing: z.number().int().nonnegative()
  }).strict()),
  credits: z.object({
    knownSubtotal: z.number().int().nonnegative(),
    total: z.number().int().nonnegative().nullable(),
    complete: z.boolean()
  }).strict(),
  specialists: z.array(z.object({ id: z.string().min(1), name: z.string().min(1) }).strict()),
  unresolvedInstalledModifications: z.array(z.object({
    symbol: z.string().min(1),
    name: z.string().min(1)
  }).strict())
}).strict()

export type PersonalEquipmentPlannerOptionsResponse = z.infer<typeof PersonalEquipmentPlannerOptionsResponseSchema>
export type PersonalEquipmentPlannerEquipment = z.infer<typeof PersonalEquipmentPlannerEquipmentSchema>
export type PersonalEquipmentPlannerSource = z.infer<typeof PersonalEquipmentPlannerSourceSchema>
export type PersonalEquipmentPlanPreviewRequest = z.infer<typeof PersonalEquipmentPlanPreviewRequestSchema>
export type PersonalEquipmentPlanPreviewResponse = z.infer<typeof PersonalEquipmentPlanPreviewResponseSchema>
