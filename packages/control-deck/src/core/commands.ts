import { z } from 'zod'

export const CommandIdSchema = z.string().min(1).max(200)
export const CommandOperationSchema = z.enum(['tap', 'press', 'release'])
export const CommandRiskSchema = z.enum(['safe', 'caution', 'dangerous', 'destructive'])
export const CommandResultStatusSchema = z.enum([
  'already_satisfied',
  'accepted',
  'confirmed',
  'unconfirmed',
  'rejected',
  'cancelled',
  'timed_out',
  'failed'
])

export const CommandDescriptorSchema = z.object({
  id: CommandIdSchema,
  kind: z.string().min(1).max(80),
  label: z.string().min(1).max(160),
  description: z.string().min(1).max(1000).optional(),
  groupId: z.string().min(1).max(100),
  available: z.boolean(),
  unavailableReason: z.string().min(1).max(500).optional(),
  risk: CommandRiskSchema,
  supportedOperations: z.array(CommandOperationSchema).min(1).max(3).default(['tap']),
  recordable: z.boolean().default(true),
  display: z.object({ binding: z.string().min(1).max(100).optional() }).optional(),
  numericAddress: z.string().regex(/^\d+$/u).optional()
})

export const CommandCatalogueSnapshotSchema = z.object({
  revision: z.number().int().positive(),
  generatedAt: z.iso.datetime(),
  commands: z.array(CommandDescriptorSchema)
}).superRefine((snapshot, context) => {
  const ids = new Set<string>()
  for (const [index, command] of snapshot.commands.entries()) {
    if (ids.has(command.id)) {
      context.addIssue({ code: 'custom', message: `Duplicate command id: ${command.id}.`, path: ['commands', index, 'id'] })
    }
    ids.add(command.id)
  }
})

export const CommandCatalogueRevisionSchema = z.object({
  revision: z.number().int().positive(),
  generatedAt: z.iso.datetime()
})

export const CommandCatalogueSchema = z.object({ commands: z.array(CommandDescriptorSchema) })

export const ExecuteCommandRequestSchema = z.object({
  commandId: CommandIdSchema,
  operation: CommandOperationSchema.default('tap'),
  leaseId: z.string().min(1).max(200).optional(),
  requestId: z.string().min(1).optional(),
  correlationId: z.string().min(1).optional(),
  idempotencyKey: z.string().min(1).max(200).optional(),
  timeoutMs: z.number().int().min(1).max(30_000).optional()
})

export const CommandExecutionResultSchema = z.object({
  requestId: z.string().min(1),
  correlationId: z.string().min(1),
  commandId: CommandIdSchema,
  operation: CommandOperationSchema,
  origin: z.string().min(1).max(80),
  status: CommandResultStatusSchema,
  timestamp: z.iso.datetime(),
  message: z.string().min(1)
})

export const CommandStateSchema = z.object({
  commandId: CommandIdSchema,
  selected: z.boolean().optional(),
  executing: z.boolean().optional()
})

export type CommandCatalogue = z.infer<typeof CommandCatalogueSchema>
export type CommandCatalogueRevision = z.infer<typeof CommandCatalogueRevisionSchema>
export type CommandCatalogueSnapshot = z.infer<typeof CommandCatalogueSnapshotSchema>
export type CommandDescriptor = z.infer<typeof CommandDescriptorSchema>
export type CommandExecutionResult = z.infer<typeof CommandExecutionResultSchema>
export type CommandId = z.infer<typeof CommandIdSchema>
export type CommandOperation = z.infer<typeof CommandOperationSchema>
export type CommandResultStatus = z.infer<typeof CommandResultStatusSchema>
export type CommandRisk = z.infer<typeof CommandRiskSchema>
export type CommandState = z.infer<typeof CommandStateSchema>
export type ExecuteCommandRequest = z.infer<typeof ExecuteCommandRequestSchema>

export function commandById (
  snapshot: CommandCatalogueSnapshot,
  commandId: string
): CommandDescriptor | undefined {
  return snapshot.commands.find(command => command.id === commandId)
}
