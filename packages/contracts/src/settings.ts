import { z } from 'zod'
import {
  ControlDeckColorSchemeSchema,
  ControlDeckConfigurationSchema,
  ControlDeckGridDeckSchema,
  type ControlDeckCommandTarget
} from 'control-deck/core'
import type { CommandTarget } from './commands.js'

export const InputBackendModeSchema = z.enum(['auto', 'recording', 'linux-xdotool', 'windows-sendinput'])
export const PhoenixControlDeckThemeSchema = z.union([z.literal('phoenix'), ControlDeckColorSchemeSchema])
export const PHOENIX_CONTROL_DECK_ADAPTER_ID = 'phoenix.commands'
export const PHOENIX_CONTROL_CONTEXTS = [
  'phoenix:ship',
  'phoenix:combat',
  'phoenix:navigation',
  'phoenix:vessel',
  'phoenix:srv',
  'phoenix:on_foot',
  'phoenix:radio',
  'phoenix:emote',
  'phoenix:misc'
] as const
export const PhoenixControlDeckConfigurationSchema = ControlDeckConfigurationSchema.safeExtend({
  decks: z.array(ControlDeckGridDeckSchema).max(256)
}).superRefine((configuration, context) => {
  const expectedContexts = new Set<string>(PHOENIX_CONTROL_CONTEXTS)
  const actualContexts = new Set(configuration.decks.map(deck => deck.context))
  if (configuration.decks.length !== expectedContexts.size || actualContexts.size !== expectedContexts.size) {
    context.addIssue({ code: 'custom', message: 'PHOENIX requires exactly one deck for each Elite control context.' })
  }
  for (const expected of expectedContexts) {
    if (!actualContexts.has(expected)) context.addIssue({ code: 'custom', message: `Missing PHOENIX control context ${expected}.` })
  }
  for (const deck of configuration.decks) {
    if (!deck.context || !expectedContexts.has(deck.context)) {
      context.addIssue({ code: 'custom', message: `Unsupported PHOENIX control context ${deck.context ?? 'null'}.` })
    }
    for (const element of deck.elements) {
      if (element.kind === 'command' && (element.target.adapterId !== PHOENIX_CONTROL_DECK_ADAPTER_ID || Object.keys(element.target.configuration).length > 0)) {
        context.addIssue({ code: 'custom', message: `Deck ${deck.id} contains a non-PHOENIX command target.` })
      }
    }
  }
})

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
    cancelAfterMs: z.number().int().min(1000).max(60_000).default(5000)
  })
})

export function phoenixTargetToControlDeckTarget (target: CommandTarget): ControlDeckCommandTarget {
  const commandId = target.type === 'game-action'
    ? `command.${target.actionId}`
    : target.type === 'navigation'
      ? `command.navigation.${target.destinationId}`
      : `command.macro.${target.macroId}`
  return { adapterId: PHOENIX_CONTROL_DECK_ADAPTER_ID, commandId, configuration: {} }
}

export function controlDeckTargetToPhoenixTarget (target: ControlDeckCommandTarget): CommandTarget {
  if (target.adapterId !== PHOENIX_CONTROL_DECK_ADAPTER_ID || Object.keys(target.configuration).length > 0) {
    throw new Error('PHOENIX controls accept only unconfigured PHOENIX command targets.')
  }
  if (target.commandId.startsWith('command.navigation.')) {
    return { type: 'navigation', destinationId: target.commandId.slice('command.navigation.'.length) }
  }
  if (target.commandId.startsWith('command.macro.')) {
    return { type: 'macro', macroId: target.commandId.slice('command.macro.'.length) }
  }
  if (target.commandId.startsWith('command.')) {
    return { type: 'game-action', actionId: target.commandId.slice('command.'.length) }
  }
  throw new Error(`Unknown PHOENIX command target: ${target.commandId}.`)
}

export const PhoenixSettingsSchema = z.object({
  version: z.literal(1),
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
    deckConfiguration: PhoenixControlDeckConfigurationSchema
  }),
  modules: PhoenixModulesSchema.default({
    numpadCommands: {
      inputAdapter: 'browser',
      presentation: 'tiles',
      alwaysConfirm: false,
      cancelAfterMs: 5000
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
export type PhoenixControlDeckTheme = z.infer<typeof PhoenixControlDeckThemeSchema>
export type PhoenixControlDeckConfiguration = z.infer<typeof PhoenixControlDeckConfigurationSchema>
export type PhoenixSettings = z.infer<typeof PhoenixSettingsSchema>
export type OpenAiConfigurationStatus = z.infer<typeof OpenAiConfigurationStatusSchema>
export type InstallationSettings = z.infer<typeof InstallationSettingsSchema>
export type InstallationSettingsUpdate = z.infer<typeof InstallationSettingsUpdateSchema>
export type OpenAiApiKeyRequest = z.infer<typeof OpenAiApiKeyRequestSchema>
export type RuntimeSystemSnapshot = z.infer<typeof RuntimeSystemSnapshotSchema>
