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
