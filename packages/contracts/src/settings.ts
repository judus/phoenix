import { z } from 'zod'

export const InputBackendModeSchema = z.enum(['auto', 'recording', 'linux-xdotool'])

export const PhoenixSettingsSchema = z.object({
  version: z.literal(1),
  controls: z.object({
    enabled: z.boolean(),
    backend: InputBackendModeSchema
  })
})

export const RuntimeSystemSnapshotSchema = z.object({
  version: z.literal(1),
  generatedAt: z.iso.datetime(),
  platform: z.string().min(1),
  session: z.string().min(1).nullable(),
  controls: z.object({
    enabled: z.boolean(),
    configuredBackend: InputBackendModeSchema,
    overrideBackend: InputBackendModeSchema.nullable(),
    effectiveBackend: z.string().min(1),
    available: z.boolean(),
    simulated: z.boolean(),
    detail: z.string().min(1)
  })
})

export type InputBackendMode = z.infer<typeof InputBackendModeSchema>
export type PhoenixSettings = z.infer<typeof PhoenixSettingsSchema>
export type RuntimeSystemSnapshot = z.infer<typeof RuntimeSystemSnapshotSchema>
