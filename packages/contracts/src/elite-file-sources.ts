import { z } from 'zod'

export const EliteWatchedFileDiagnosticsSchema = z.object({
  error: z.string().min(1).nullable(),
  fileAvailable: z.boolean(),
  filePath: z.string().min(1),
  lastReadAt: z.iso.datetime().nullable()
})

export const EliteInventorySourceDiagnosticsSchema = z.object({
  directory: z.string().min(1).nullable(),
  error: z.string().min(1).nullable(),
  files: z.array(EliteWatchedFileDiagnosticsSchema),
  watching: z.boolean()
})

export const EliteNavigationRouteSourceDiagnosticsSchema = EliteWatchedFileDiagnosticsSchema.extend({
  directory: z.string().min(1).nullable(),
  filePath: z.string().min(1).nullable(),
  watching: z.boolean()
})

export type EliteWatchedFileDiagnostics = z.infer<typeof EliteWatchedFileDiagnosticsSchema>
export type EliteInventorySourceDiagnostics = z.infer<typeof EliteInventorySourceDiagnosticsSchema>
export type EliteNavigationRouteSourceDiagnostics = z.infer<typeof EliteNavigationRouteSourceDiagnosticsSchema>
