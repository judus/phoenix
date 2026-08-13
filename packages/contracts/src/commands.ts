import { z } from 'zod'
import {
  GameActionOperationSchema,
  GameActionOriginSchema,
  GameActionResultSchema,
  GameActionResultStatusSchema
} from './actions.js'

export const CommandTargetSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('game-action'), actionId: z.string().min(1) }),
  z.object({ type: z.literal('navigation'), destinationId: z.string().min(1) }),
  z.object({ type: z.literal('macro'), macroId: z.string().min(1) })
])

export const CommandRiskSchema = z.enum(['safe', 'caution', 'dangerous', 'destructive'])

export const CommandDescriptorSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['game-action', 'navigation', 'macro']),
  label: z.string().min(1),
  description: z.string().min(1).optional(),
  category: z.string().min(1),
  available: z.boolean(),
  unavailableReason: z.string().min(1).optional(),
  risk: CommandRiskSchema,
  target: CommandTargetSchema,
  numericAddress: z.string().regex(/^\d+$/u).optional()
})

export const CommandCatalogResponseSchema = z.object({
  commands: z.array(CommandDescriptorSchema)
})

export const CommandCatalogueSnapshotSchema = z.object({
  revision: z.number().int().positive(),
  generatedAt: z.iso.datetime(),
  commands: z.array(CommandDescriptorSchema)
})

export const CommandCatalogueRevisionSchema = CommandCatalogueSnapshotSchema.pick({
  revision: true,
  generatedAt: true
})

export const ExecuteCommandRequestSchema = z.object({
  target: CommandTargetSchema,
  operation: GameActionOperationSchema.default('tap'),
  requestId: z.string().min(1).optional(),
  correlationId: z.string().min(1).optional(),
  idempotencyKey: z.string().min(1).max(200).optional(),
  timeoutMs: z.number().int().min(1).max(30_000).optional()
})

export const CommandExecutionResultSchema = z.object({
  requestId: z.string().min(1),
  correlationId: z.string().min(1),
  commandId: z.string().min(1),
  target: CommandTargetSchema,
  operation: GameActionOperationSchema,
  origin: GameActionOriginSchema,
  status: GameActionResultStatusSchema,
  timestamp: z.iso.datetime(),
  message: z.string().min(1),
  navigationHref: z.string().min(1).nullable(),
  gameActionResult: GameActionResultSchema.nullable()
})

export type CommandCatalogResponse = z.infer<typeof CommandCatalogResponseSchema>
export type CommandCatalogueSnapshot = z.infer<typeof CommandCatalogueSnapshotSchema>
export type CommandCatalogueRevision = z.infer<typeof CommandCatalogueRevisionSchema>
export type CommandDescriptor = z.infer<typeof CommandDescriptorSchema>
export type CommandExecutionResult = z.infer<typeof CommandExecutionResultSchema>
export type CommandRisk = z.infer<typeof CommandRiskSchema>
export type CommandTarget = z.infer<typeof CommandTargetSchema>
export type ExecuteCommandRequest = z.infer<typeof ExecuteCommandRequestSchema>

export function commandTargetKey (target: CommandTarget): string {
  switch (target.type) {
    case 'game-action': return `game-action:${target.actionId}`
    case 'navigation': return `navigation:${target.destinationId}`
    case 'macro': return `macro:${target.macroId}`
  }
}
