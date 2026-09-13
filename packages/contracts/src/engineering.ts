import { z } from 'zod'

export const CommanderEngineerProgressSchema = z.object({
  id: z.number().int().nonnegative(),
  name: z.string().min(1),
  status: z.string().min(1).nullable(),
  rank: z.number().int().nonnegative(),
  rankProgress: z.number().finite().nonnegative()
})

export const EngineeringEngineerSchema = z.object({
  id: z.number().int().nonnegative(),
  name: z.string().min(1),
  description: z.string().min(1),
  system: z.object({
    name: z.string().min(1),
    address: z.number().int().nonnegative().nullable(),
    position: z.tuple([z.number().finite(), z.number().finite(), z.number().finite()]).nullable()
  }),
  marketId: z.number().int().nonnegative().nullable(),
  progress: CommanderEngineerProgressSchema.omit({ id: true, name: true }),
  state: z.enum(['unlocked', 'known', 'locked']),
  distanceLy: z.number().finite().nonnegative().nullable()
})

export const EngineeringMaterialUseSchema = z.object({
  symbol: z.string().min(1),
  name: z.string().min(1),
  grades: z.array(z.number().int().positive())
})

export const EngineeringMaterialViewSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  category: z.enum(['raw', 'manufactured', 'encoded', 'xeno']),
  group: z.string().min(1),
  grade: z.number().int().min(1).max(5),
  rarity: z.string().min(1),
  count: z.number().int().nonnegative(),
  maxCount: z.number().int().positive(),
  blueprintUses: z.array(EngineeringMaterialUseSchema)
})

export const EngineeringBlueprintSummarySchema = z.object({
  symbol: z.string().min(1),
  name: z.string().min(1),
  originalName: z.string().min(1),
  moduleNames: z.array(z.string().min(1)),
  appliedModuleCount: z.number().int().nonnegative()
})

export const EngineeringBlueprintComponentSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  category: z.enum(['raw', 'manufactured', 'encoded', 'xeno']).nullable(),
  grade: z.number().int().min(1).max(5).nullable(),
  count: z.number().int().nonnegative(),
  cost: z.number().int().positive()
})

export const EngineeringBlueprintFeatureSchema = z.object({
  name: z.string().min(1),
  values: z.array(z.number().finite()),
  improvement: z.boolean(),
  type: z.string().min(1).nullable()
})

export const EngineeringBlueprintGradeSchema = z.object({
  grade: z.number().int().positive(),
  components: z.array(EngineeringBlueprintComponentSchema),
  features: z.array(EngineeringBlueprintFeatureSchema)
})

export const EngineeringBlueprintEngineerSchema = z.object({
  name: z.string().min(1),
  grades: z.array(z.number().int().positive()),
  systemName: z.string().min(1).nullable(),
  distanceLy: z.number().finite().nonnegative().nullable(),
  status: z.string().min(1).nullable(),
  rank: z.number().int().nonnegative()
})

export const EngineeringAppliedModuleSchema = z.object({
  slotId: z.string().min(1),
  name: z.string().min(1),
  grade: z.number().int().positive().nullable(),
  experimentalEffect: z.string().min(1).nullable()
})

export const EngineeringBlueprintDetailSchema = EngineeringBlueprintSummarySchema.extend({
  engineers: z.array(EngineeringBlueprintEngineerSchema),
  grades: z.array(EngineeringBlueprintGradeSchema),
  appliedModules: z.array(EngineeringAppliedModuleSchema)
})

export const EngineeringEngineersResponseSchema = z.object({
  engineers: z.array(EngineeringEngineerSchema)
})

export const EngineeringMaterialsResponseSchema = z.object({
  updatedAt: z.iso.datetime().nullable(),
  materials: z.array(EngineeringMaterialViewSchema)
})

export const EngineeringBlueprintsResponseSchema = z.object({
  blueprints: z.array(EngineeringBlueprintSummarySchema)
})

export const EngineeringProjectStatusSchema = z.enum(['active', 'paused', 'completed', 'archived'])
export const EngineeringProjectPrioritySchema = z.enum(['high', 'normal', 'low'])

export const EngineeringProjectRequirementSchema = z.object({
  materialId: z.string().min(1),
  materialName: z.string().min(1),
  category: z.enum(['raw', 'manufactured', 'encoded', 'xeno']).nullable(),
  grade: z.number().int().min(1).max(5).nullable(),
  unitCost: z.number().int().positive(),
  required: z.number().int().positive()
}).strict()

export const EngineeringProjectStepSchema = z.object({
  id: z.string().uuid(),
  kind: z.literal('blueprint'),
  blueprintSymbol: z.string().min(1),
  blueprintName: z.string().min(1),
  moduleNames: z.array(z.string().min(1)),
  targetGrade: z.number().int().min(1).max(5),
  plannedRolls: z.number().int().min(1).max(100),
  note: z.string().trim().max(500).nullable(),
  requirements: z.array(EngineeringProjectRequirementSchema),
  createdAt: z.iso.datetime()
}).strict()

export const EngineeringProjectSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  status: EngineeringProjectStatusSchema,
  priority: EngineeringProjectPrioritySchema,
  note: z.string().trim().max(1000).nullable(),
  steps: z.array(EngineeringProjectStepSchema),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime()
}).strict()

export const EngineeringProjectCreateRequestSchema = z.object({
  name: z.string().trim().min(1).max(120),
  priority: EngineeringProjectPrioritySchema.default('normal'),
  note: z.string().trim().max(1000).nullable().default(null)
}).strict()

export const EngineeringProjectUpdateRequestSchema = z.object({
  name: z.string().trim().min(1).max(120),
  status: EngineeringProjectStatusSchema,
  priority: EngineeringProjectPrioritySchema,
  note: z.string().trim().max(1000).nullable()
}).strict()

export const EngineeringProjectStepCreateRequestSchema = z.object({
  blueprintSymbol: z.string().trim().min(1),
  targetGrade: z.number().int().min(1).max(5),
  plannedRolls: z.number().int().min(1).max(100),
  note: z.string().trim().max(500).nullable().default(null)
}).strict()

export const EngineeringProjectsResponseSchema = z.object({
  schemaVersion: z.literal(1),
  projects: z.array(EngineeringProjectSchema)
}).strict()

export const EngineeringMaterialWatchItemSchema = z.object({
  materialId: z.string().min(1),
  materialName: z.string().min(1),
  category: z.enum(['raw', 'manufactured', 'encoded', 'xeno']).nullable(),
  grade: z.number().int().min(1).max(5).nullable(),
  owned: z.number().int().nonnegative(),
  required: z.number().int().positive(),
  missing: z.number().int().positive(),
  projectCount: z.number().int().positive(),
  stepCount: z.number().int().positive(),
  highestPriority: EngineeringProjectPrioritySchema,
  projects: z.array(z.object({
    id: z.string().uuid(),
    name: z.string().min(1)
  }).strict())
}).strict()

export const EngineeringMaterialWatchlistResponseSchema = z.object({
  schemaVersion: z.literal(1),
  observedAt: z.iso.datetime().nullable(),
  activeProjectCount: z.number().int().nonnegative(),
  materials: z.array(EngineeringMaterialWatchItemSchema)
}).strict()

export const EngineeringProjectsChangedSchema = z.object({
  schemaVersion: z.literal(1),
  changedAt: z.iso.datetime()
}).strict()

export type CommanderEngineerProgress = z.infer<typeof CommanderEngineerProgressSchema>
export type EngineeringEngineer = z.infer<typeof EngineeringEngineerSchema>
export type EngineeringMaterial = z.infer<typeof EngineeringMaterialViewSchema>
export type EngineeringBlueprintSummary = z.infer<typeof EngineeringBlueprintSummarySchema>
export type EngineeringBlueprintDetail = z.infer<typeof EngineeringBlueprintDetailSchema>
export type EngineeringEngineersResponse = z.infer<typeof EngineeringEngineersResponseSchema>
export type EngineeringMaterialsResponse = z.infer<typeof EngineeringMaterialsResponseSchema>
export type EngineeringBlueprintsResponse = z.infer<typeof EngineeringBlueprintsResponseSchema>
export type EngineeringProject = z.infer<typeof EngineeringProjectSchema>
export type EngineeringProjectCreateRequest = z.infer<typeof EngineeringProjectCreateRequestSchema>
export type EngineeringProjectUpdateRequest = z.infer<typeof EngineeringProjectUpdateRequestSchema>
export type EngineeringProjectStepCreateRequest = z.infer<typeof EngineeringProjectStepCreateRequestSchema>
export type EngineeringProjectsResponse = z.infer<typeof EngineeringProjectsResponseSchema>
export type EngineeringMaterialWatchItem = z.infer<typeof EngineeringMaterialWatchItemSchema>
export type EngineeringMaterialWatchlistResponse = z.infer<typeof EngineeringMaterialWatchlistResponseSchema>
export type EngineeringProjectsChanged = z.infer<typeof EngineeringProjectsChangedSchema>
