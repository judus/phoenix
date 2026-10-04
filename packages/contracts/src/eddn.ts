import { z } from 'zod'

export const EddnSettingsUpdateSchema = z.object({ enabled: z.boolean() })
export const EddnStatusSchema = z.object({
  enabled: z.boolean(),
  mode: z.enum(['unavailable', 'test']),
  queued: z.number().int().nonnegative(),
  lastSuccessAt: z.iso.datetime().nullable(),
  detail: z.string(),
  error: z.string().nullable()
})
export type EddnSettingsUpdate = z.infer<typeof EddnSettingsUpdateSchema>
export type EddnStatus = z.infer<typeof EddnStatusSchema>

export const EddnSubmissionSchema = z.object({
  id: z.number().int(),
  observationId: z.string(),
  startedAt: z.iso.datetime(),
  completedAt: z.iso.datetime().nullable(),
  attempt: z.number().int().positive(),
  outcome: z.enum(['sending', 'accepted', 'retry', 'rejected', 'interrupted']),
  httpStatus: z.number().int().nullable(),
  retryAt: z.iso.datetime().nullable(),
  schemaRef: z.string(),
  event: z.string().nullable(),
  system: z.string().nullable(),
  station: z.string().nullable()
})
export const EddnSubmissionLogSchema = z.object({ status: EddnStatusSchema, entries: z.array(EddnSubmissionSchema) })
export const EddnSubmissionDetailSchema = z.object({ payload: z.record(z.string(), z.unknown()) })
export type EddnSubmission = z.infer<typeof EddnSubmissionSchema>
export type EddnSubmissionLog = z.infer<typeof EddnSubmissionLogSchema>
export type EddnSubmissionDetail = z.infer<typeof EddnSubmissionDetailSchema>
