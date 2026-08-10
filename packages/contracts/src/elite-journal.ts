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

export type EliteJournalSourceDiagnostics = z.infer<typeof EliteJournalSourceDiagnosticsSchema>
