import { z } from 'zod'
import { GameActionCategorySchema } from './actions.js'
import { CommandTargetSchema } from './commands.js'
import { NumpadShortcutCollectionSchema } from './numpad.js'

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

const ControlGridCellSchema = z.object({
  position: z.number().int().positive().max(128),
  span: z.number().int().min(1).max(12).default(1),
  target: CommandTargetSchema.nullable()
})

const ControlGridPageSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9_]*$/),
  label: z.string().min(1).max(32),
  category: GameActionCategorySchema,
  columns: z.number().int().min(2).max(12),
  rows: z.number().int().min(1).max(12).default(5),
  cells: z.array(ControlGridCellSchema).max(128)
}).superRefine((page, context) => {
  const capacity = page.columns * page.rows
  const occupied = new Set<number>()

  for (const cell of page.cells) {
    if (cell.position + cell.span - 1 > capacity) {
      context.addIssue({
        code: 'custom',
        message: `Cell ${cell.position} exceeds the ${page.columns} x ${page.rows} grid.`
      })
    }
    if ((cell.position - 1) % page.columns + cell.span > page.columns) {
      context.addIssue({
        code: 'custom',
        message: `Cell ${cell.position} crosses a row boundary.`
      })
    }
    for (let position = cell.position; position < cell.position + cell.span; position++) {
      if (occupied.has(position)) {
        context.addIssue({ code: 'custom', message: `Grid position ${position} is occupied twice.` })
      }
      occupied.add(position)
    }
  }
})

export const ControlGridLayoutSchema = z.object({
  version: z.literal(4),
  pages: z.array(ControlGridPageSchema).max(16)
}).superRefine((layout, context) => {
  const pageIds = new Set<string>()
  const categories = new Set<string>()
  for (const page of layout.pages) {
    if (pageIds.has(page.id)) context.addIssue({ code: 'custom', message: `Duplicate page id: ${page.id}.` })
    if (categories.has(page.category)) {
      context.addIssue({ code: 'custom', message: `Duplicate control category: ${page.category}.` })
    }
    pageIds.add(page.id)
    categories.add(page.category)
  }
})

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
    layout: ControlGridLayoutSchema.default({ version: 4, pages: [] })
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
export type ControlGridLayout = z.infer<typeof ControlGridLayoutSchema>
export type PhoenixSettings = z.infer<typeof PhoenixSettingsSchema>
export type OpenAiConfigurationStatus = z.infer<typeof OpenAiConfigurationStatusSchema>
export type InstallationSettings = z.infer<typeof InstallationSettingsSchema>
export type InstallationSettingsUpdate = z.infer<typeof InstallationSettingsUpdateSchema>
export type OpenAiApiKeyRequest = z.infer<typeof OpenAiApiKeyRequestSchema>
export type RuntimeSystemSnapshot = z.infer<typeof RuntimeSystemSnapshotSchema>
