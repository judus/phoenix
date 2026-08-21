import { z } from 'zod'
import {
  CommandExecutionResultSchema,
  CommandRiskSchema,
  CommandTargetSchema
} from './commands.js'

export const NumpadSelectorSchema = z.string().regex(/^\d+$/u).max(3)
export const NumpadAddressSchema = z.string().regex(/^\d+$/u).max(32)

export const NumpadShortcutSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]*$/u),
  selector: NumpadSelectorSchema,
  label: z.string().min(1).max(80).optional(),
  target: CommandTargetSchema
})

export const NumpadShortcutCollectionSchema = z.array(NumpadShortcutSchema).max(100).superRefine((shortcuts, context) => {
  const ids = new Set<string>()
  const selectors = new Set<string>()
  for (const [index, shortcut] of shortcuts.entries()) {
    if (ids.has(shortcut.id)) context.addIssue({ code: 'custom', message: `Duplicate shortcut id: ${shortcut.id}.`, path: [index, 'id'] })
    if (selectors.has(shortcut.selector)) context.addIssue({ code: 'custom', message: `Shortcut ${shortcut.selector} is assigned twice.`, path: [index, 'selector'] })
    ids.add(shortcut.id)
    selectors.add(shortcut.selector)
  }
})

export const NumpadTreeNodeSchema = z.object({
  id: z.string().min(1),
  parentId: z.string().min(1).nullable(),
  selector: NumpadSelectorSchema,
  address: NumpadAddressSchema,
  label: z.string().min(1),
  description: z.string().min(1).optional(),
  kind: z.enum(['menu', 'navigation', 'game-action', 'macro']),
  available: z.boolean(),
  unavailableReason: z.string().min(1).optional(),
  risk: CommandRiskSchema,
  target: CommandTargetSchema.nullable(),
  position: z.number().int().positive().optional(),
  span: z.number().int().positive().max(12).optional(),
  columns: z.number().int().min(1).max(12).optional(),
  rows: z.number().int().min(1).max(12).optional()
})

export const NumpadTreeSnapshotSchema = z.object({
  revision: z.number().int().positive(),
  generatedAt: z.iso.datetime(),
  activationDigit: z.literal('0'),
  nodes: z.array(NumpadTreeNodeSchema).max(1024),
  diagnostics: z.array(z.string()).max(100)
})

export const NumpadExecuteRequestSchema = z.object({
  address: NumpadAddressSchema,
  revision: z.number().int().positive()
})

export const NumpadExecutionResultSchema = z.object({
  address: NumpadAddressSchema,
  revision: z.number().int().positive(),
  status: z.enum(['accepted', 'rejected', 'stale']),
  message: z.string().min(1),
  command: CommandExecutionResultSchema.nullable()
})

export type NumpadTreeNode = z.infer<typeof NumpadTreeNodeSchema>
export type NumpadTreeSnapshot = z.infer<typeof NumpadTreeSnapshotSchema>
export type NumpadExecuteRequest = z.infer<typeof NumpadExecuteRequestSchema>
export type NumpadExecutionResult = z.infer<typeof NumpadExecutionResultSchema>
export type NumpadShortcut = z.infer<typeof NumpadShortcutSchema>
