import { z } from 'zod'

export const GameActionOperationSchema = z.enum(['tap', 'press', 'release'])
export const GameActionOriginSchema = z.enum(['ui', 'developer', 'copilot', 'automation'])
export const GameActionResultStatusSchema = z.enum([
  'already_satisfied',
  'accepted',
  'confirmed',
  'unconfirmed',
  'rejected',
  'timed_out',
  'failed'
])

export const GameActionCategorySchema = z.enum([
  'ship',
  'combat',
  'navigation',
  'srv',
  'on_foot',
  'vessel',
  'radio',
  'emote',
  'system',
  'misc'
])

export const GameActionDefinitionSchema = z.object({
  id: z.string().regex(/^[A-Za-z][A-Za-z0-9_-]*(?:\.[A-Za-z][A-Za-z0-9_-]*)+$/),
  label: z.string().min(1),
  description: z.string().min(1),
  category: GameActionCategorySchema,
  inputMode: z.enum(['tap', 'hold']),
  risk: z.enum(['routine', 'caution', 'dangerous']),
  eliteBinding: z.string().min(1),
  telemetryKey: z.string().min(1).nullable()
})

export const LogicalInputChordSchema = z.object({
  key: z.string().min(1),
  modifiers: z.array(z.string().min(1)).max(3),
  display: z.string().min(1)
})

export const ResolvedGameActionBindingSchema = z.object({
  eliteBinding: z.string().min(1),
  binding: LogicalInputChordSchema
})

export const GameActionAvailabilitySchema = z.object({
  definition: GameActionDefinitionSchema,
  available: z.boolean(),
  binding: LogicalInputChordSchema.nullable(),
  unavailableReason: z.string().min(1).nullable()
})

export const InputBackendStatusSchema = z.object({
  id: z.string().min(1),
  available: z.boolean(),
  simulated: z.boolean(),
  detail: z.string().min(1)
})

export const GameActionBindingSourceDiagnosticsSchema = z.object({
  directory: z.string().min(1).nullable(),
  filePath: z.string().min(1).nullable(),
  presetNames: z.array(z.string().min(1)),
  available: z.boolean(),
  bindingCount: z.number().int().nonnegative(),
  keyboardBindingCount: z.number().int().nonnegative(),
  loadedAt: z.iso.datetime().nullable(),
  error: z.string().min(1).nullable()
})

export const GameActionCatalogResponseSchema = z.object({
  backend: InputBackendStatusSchema,
  bindingSource: GameActionBindingSourceDiagnosticsSchema,
  actions: z.array(GameActionAvailabilitySchema)
})

export const ExecuteGameActionRequestSchema = z.object({
  actionId: GameActionDefinitionSchema.shape.id,
  operation: GameActionOperationSchema.default('tap')
})

export const GameActionCommandSchema = ExecuteGameActionRequestSchema.extend({
  origin: GameActionOriginSchema
})

export const GameActionResultSchema = z.object({
  requestId: z.string().min(1),
  actionId: GameActionDefinitionSchema.shape.id,
  operation: GameActionOperationSchema,
  origin: GameActionOriginSchema,
  status: GameActionResultStatusSchema,
  timestamp: z.iso.datetime(),
  message: z.string().min(1)
})

export type ExecuteGameActionRequest = z.infer<typeof ExecuteGameActionRequestSchema>
export type GameActionAvailability = z.infer<typeof GameActionAvailabilitySchema>
export type GameActionCategory = z.infer<typeof GameActionCategorySchema>
export type GameActionCatalogResponse = z.infer<typeof GameActionCatalogResponseSchema>
export type GameActionCommand = z.infer<typeof GameActionCommandSchema>
export type GameActionBindingSourceDiagnostics = z.infer<typeof GameActionBindingSourceDiagnosticsSchema>
export type GameActionDefinition = z.infer<typeof GameActionDefinitionSchema>
export type GameActionOperation = z.infer<typeof GameActionOperationSchema>
export type GameActionOrigin = z.infer<typeof GameActionOriginSchema>
export type GameActionResult = z.infer<typeof GameActionResultSchema>
export type InputBackendStatus = z.infer<typeof InputBackendStatusSchema>
export type ResolvedGameActionBinding = z.infer<typeof ResolvedGameActionBindingSchema>
export type LogicalInputChord = z.infer<typeof LogicalInputChordSchema>
