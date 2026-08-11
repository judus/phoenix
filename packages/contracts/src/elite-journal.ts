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
  error: z.string().min(1).nullable(),
  backfill: z.object({
    status: z.enum(['idle', 'running', 'complete', 'stopped', 'error']),
    filesDiscovered: z.number().int().nonnegative(),
    filesCompleted: z.number().int().nonnegative(),
    bytesTotal: z.number().int().nonnegative(),
    bytesProcessed: z.number().int().nonnegative(),
    linesProcessed: z.number().int().nonnegative(),
    currentFilePath: z.string().min(1).nullable(),
    startedAt: z.iso.datetime().nullable(),
    completedAt: z.iso.datetime().nullable(),
    error: z.string().min(1).nullable()
  }).optional()
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
export type EliteJournalBackfillDiagnostics = NonNullable<EliteJournalSourceDiagnostics['backfill']>
export type ActivityLogEntry = z.infer<typeof ActivityLogEntrySchema>
export type ActivityLogResponse = z.infer<typeof ActivityLogResponseSchema>
