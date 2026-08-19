import { z } from 'zod'
import {
  ControlGridLayoutSchema,
  NumpadShortcutCollectionSchema,
  type ControlGridLayout
} from '@phoenix/control-deck'

export { ControlGridLayoutSchema } from '@phoenix/control-deck'
export type { ControlGridLayout } from '@phoenix/control-deck'

export const InputBackendModeSchema = z.enum(['auto', 'recording', 'linux-xdotool', 'windows-sendinput'])

export const CopilotExecutionPermissionsSchema = z.object({
  gameActions: z.boolean().default(false),
  macros: z.boolean().default(false),
  dangerousActions: z.boolean().default(false)
})

export const PhoenixModulesSchema = z.object({
  numpadCommands: z.object({
    inputAdapter: z.enum(['browser', 'touch', 'both']).default('browser'),
    presentation: z.enum(['tiles', 'columns']).default('tiles'),
    alwaysConfirm: z.boolean().default(false),
    cancelAfterMs: z.number().int().min(1000).max(60_000).default(5000),
    shortcuts: NumpadShortcutCollectionSchema.default([])
  })
})

export const PhoenixSettingsSchema = z.object({
  version: z.literal(2),
  copilot: z.object({
    activeProfileId: z.string().regex(/^[a-z][a-z0-9_-]*$/u).default('marin'),
    permissions: CopilotExecutionPermissionsSchema.default({
      gameActions: false,
      macros: false,
      dangerousActions: false
    })
  }).default({
    activeProfileId: 'marin',
    permissions: { gameActions: false, macros: false, dangerousActions: false }
  }),
  controls: z.object({
    enabled: z.boolean(),
    backend: InputBackendModeSchema,
    layout: ControlGridLayoutSchema.default({ version: 5, pages: [] })
  }),
  modules: PhoenixModulesSchema.default({
    numpadCommands: {
      inputAdapter: 'browser',
      presentation: 'tiles',
      alwaysConfirm: false,
      cancelAfterMs: 5000,
      shortcuts: []
    }
  })
})

export const OpenAiConfigurationStatusSchema = z.object({
  configured: z.boolean(),
  source: z.enum(['none', 'environment', 'stored']),
  stored: z.boolean(),
  restartRequired: z.boolean()
})

export const InstallationSettingsSchema = z.object({
  controlsEnabled: z.boolean(),
  copilotPermissions: CopilotExecutionPermissionsSchema,
  openAi: OpenAiConfigurationStatusSchema
})

export const InstallationSettingsUpdateSchema = z.object({
  controlsEnabled: z.boolean(),
  copilotPermissions: CopilotExecutionPermissionsSchema
})

export const OpenAiApiKeyRequestSchema = z.object({
  apiKey: z.string().trim().min(20).max(500)
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
export type CopilotExecutionPermissions = z.infer<typeof CopilotExecutionPermissionsSchema>
export type PhoenixModules = z.infer<typeof PhoenixModulesSchema>
export type PhoenixSettings = z.infer<typeof PhoenixSettingsSchema>
export type OpenAiConfigurationStatus = z.infer<typeof OpenAiConfigurationStatusSchema>
export type InstallationSettings = z.infer<typeof InstallationSettingsSchema>
export type InstallationSettingsUpdate = z.infer<typeof InstallationSettingsUpdateSchema>
export type OpenAiApiKeyRequest = z.infer<typeof OpenAiApiKeyRequestSchema>
export type RuntimeSystemSnapshot = z.infer<typeof RuntimeSystemSnapshotSchema>
