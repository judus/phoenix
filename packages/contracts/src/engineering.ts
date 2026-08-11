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

export type CommanderEngineerProgress = z.infer<typeof CommanderEngineerProgressSchema>
export type EngineeringEngineer = z.infer<typeof EngineeringEngineerSchema>
export type EngineeringMaterial = z.infer<typeof EngineeringMaterialViewSchema>
export type EngineeringBlueprintSummary = z.infer<typeof EngineeringBlueprintSummarySchema>
export type EngineeringBlueprintDetail = z.infer<typeof EngineeringBlueprintDetailSchema>
export type EngineeringEngineersResponse = z.infer<typeof EngineeringEngineersResponseSchema>
export type EngineeringMaterialsResponse = z.infer<typeof EngineeringMaterialsResponseSchema>
export type EngineeringBlueprintsResponse = z.infer<typeof EngineeringBlueprintsResponseSchema>
