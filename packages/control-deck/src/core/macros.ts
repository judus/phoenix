import { z } from 'zod'
import {
  CommandIdSchema,
  CommandOperationSchema,
  CommandResultStatusSchema,
  CommandRiskSchema
} from './commands.js'

export const MacroStepSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('command'),
    commandId: CommandIdSchema,
    operation: CommandOperationSchema.default('tap')
  }),
  z.object({ type: z.literal('wait'), durationMs: z.number().int().min(0).max(30_000) })
])

export const MacroDefinitionSchema = z.object({
  version: z.literal(2),
  id: z.string().regex(/^[a-z][a-z0-9-]*$/u),
  name: z.string().min(1).max(80),
  description: z.string().max(500).default(''),
  enabled: z.boolean().default(true),
  risk: CommandRiskSchema.default('safe'),
  numericAddress: z.string().regex(/^\d+$/u).optional(),
  assumptions: z.array(z.string().min(1).max(200)).max(20).default([]),
  steps: z.array(MacroStepSchema).min(1).max(128)
})

export const MacroLibrarySchema = z.object({
  version: z.literal(2),
  macros: z.array(MacroDefinitionSchema).max(256)
})

export const MacroRecordingEntrySchema = z.object({
  delayBeforeMs: z.number().int().nonnegative(),
  commandId: CommandIdSchema,
  operation: CommandOperationSchema,
  status: CommandResultStatusSchema,
  message: z.string().min(1)
})

export const MacroRecordingSchema = z.object({
  id: z.string().uuid(),
  clientId: z.string().min(1),
  startedAt: z.iso.datetime(),
  status: z.enum(['recording', 'stopped']),
  entries: z.array(MacroRecordingEntrySchema)
})

export const StartMacroRecordingRequestSchema = z.object({ clientId: z.string().min(1) })
export const RecordMacroCommandRequestSchema = z.object({
  clientId: z.string().min(1),
  commandId: CommandIdSchema,
  operation: CommandOperationSchema.default('tap')
})

export const MacroPlaybackSchema = z.object({
  macroId: z.string().min(1),
  runId: z.string().uuid(),
  startedAt: z.iso.datetime(),
  completedSteps: z.number().int().nonnegative(),
  totalSteps: z.number().int().nonnegative(),
  status: z.enum(['running', 'completed', 'aborted', 'failed', 'timed_out']),
  message: z.string().min(1)
})

export type MacroDefinition = z.infer<typeof MacroDefinitionSchema>
export type MacroLibrary = z.infer<typeof MacroLibrarySchema>
export type MacroPlayback = z.infer<typeof MacroPlaybackSchema>
export type MacroRecording = z.infer<typeof MacroRecordingSchema>
export type MacroRecordingEntry = z.infer<typeof MacroRecordingEntrySchema>
export type MacroStep = z.infer<typeof MacroStepSchema>
export type RecordMacroCommandRequest = z.infer<typeof RecordMacroCommandRequestSchema>
export type StartMacroRecordingRequest = z.infer<typeof StartMacroRecordingRequestSchema>
