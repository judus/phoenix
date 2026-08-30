import { z } from 'zod'
import {
  ControlDeckNumpadNodeSchema,
  ControlDeckNumpadTreeSchema,
  type ControlDeckNumpadNode
} from 'control-deck/core'
import {
  CommandExecutionResultSchema
} from './commands.js'
import { GameActionOperationSchema } from './actions.js'

export const NumpadAddressSchema = z.string().regex(/^\d+$/u).max(32)
export const NumpadTreeNodeSchema = ControlDeckNumpadNodeSchema

export const NumpadTreeSnapshotSchema = ControlDeckNumpadTreeSchema.extend({
  revision: z.number().int().positive(),
  generatedAt: z.iso.datetime(),
  diagnostics: z.array(z.string()).max(100)
})

export const NumpadExecuteRequestSchema = z.object({
  address: NumpadAddressSchema,
  revision: z.number().int().positive(),
  operation: GameActionOperationSchema.default('tap'),
  leaseId: z.string().min(1).max(200).optional()
})

export const NumpadExecutionResultSchema = z.object({
  address: NumpadAddressSchema,
  revision: z.number().int().positive(),
  status: z.enum(['accepted', 'rejected', 'stale']),
  message: z.string().min(1),
  command: CommandExecutionResultSchema.nullable()
})

export type NumpadTreeNode = ControlDeckNumpadNode
export type NumpadTreeSnapshot = z.infer<typeof NumpadTreeSnapshotSchema>
export type NumpadExecuteRequest = z.infer<typeof NumpadExecuteRequestSchema>
export type NumpadExecutionResult = z.infer<typeof NumpadExecutionResultSchema>
