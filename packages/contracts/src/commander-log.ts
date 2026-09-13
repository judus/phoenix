import { z } from 'zod'

export const CommanderLogCategorySchema = z.enum([
  'mission',
  'trade',
  'finance',
  'fleet',
  'career',
  'engineering'
])

export const CommanderLogKindSchema = z.enum([
  'mission.accepted',
  'mission.redirected',
  'mission.completed',
  'mission.failed',
  'mission.abandoned',
  'trade.commodity_bought',
  'trade.commodity_sold',
  'finance.voucher_redeemed',
  'finance.fines_paid',
  'finance.bounties_paid',
  'finance.exploration_data_sold',
  'finance.organic_data_sold',
  'fleet.ship_bought',
  'fleet.ship_sold',
  'fleet.ship_transfer_requested',
  'fleet.ship_destroyed',
  'career.promoted',
  'engineering.access_changed',
  'engineering.blueprint_applied'
])

export const CommanderLogEntrySchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().min(1),
  timestamp: z.iso.datetime(),
  category: CommanderLogCategorySchema,
  kind: CommanderLogKindSchema,
  title: z.string().min(1),
  detail: z.string().min(1).nullable(),
  creditDelta: z.number().int().nullable(),
  tone: z.enum(['neutral', 'positive', 'warning']),
  sourceEvent: z.string().min(1)
}).strict()

export const CommanderLogResponseSchema = z.object({
  schemaVersion: z.literal(1),
  entries: z.array(CommanderLogEntrySchema),
  retained: z.number().int().nonnegative()
}).strict()

export type CommanderLogCategory = z.infer<typeof CommanderLogCategorySchema>
export type CommanderLogEntry = z.infer<typeof CommanderLogEntrySchema>
export type CommanderLogKind = z.infer<typeof CommanderLogKindSchema>
export type CommanderLogResponse = z.infer<typeof CommanderLogResponseSchema>
