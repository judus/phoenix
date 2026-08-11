import { z } from 'zod'

export const EliteJournalSourceDiagnosticsSchema = z.object({
  directory: z.string().min(1).nullable(),
  filePath: z.string().min(1).nullable(),
  watching: z.boolean(),
  fileAvailable: z.boolean(),
  bytesRead: z.number().int().nonnegative(),
  linesRead: z.number().int().nonnegative(),
  lastReadAt: z.iso.datetime().nullable(),
  lastGameTimestamp: z.iso.datetime().nullable(),
  error: z.string().min(1).nullable()
})

export const ActivityLogEntrySchema = z.object({
  id: z.string().min(1),
  timestamp: z.iso.datetime(),
  event: z.string().min(1),
  ingestedAt: z.iso.datetime(),
  source: z.enum(['journal', 'runtime', 'action', 'copilot', 'system']),
  importance: z.enum(['trace', 'info', 'notable', 'warning', 'critical']),
  actionable: z.boolean(),
  data: z.record(z.string(), z.unknown())
})

export const ActivityLogResponseSchema = z.object({
  entries: z.array(ActivityLogEntrySchema),
  retained: z.number().int().nonnegative()
})

export type EliteJournalSourceDiagnostics = z.infer<typeof EliteJournalSourceDiagnosticsSchema>
export type ActivityLogEntry = z.infer<typeof ActivityLogEntrySchema>
export type ActivityLogResponse = z.infer<typeof ActivityLogResponseSchema>
