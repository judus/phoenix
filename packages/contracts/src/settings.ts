import { z } from 'zod'
import {
  ControlDeckColorSchemeSchema,
  ControlDeckConfigurationSchema,
  type ControlDeckConfiguration,
  type ControlDeckCommandTarget
} from '@jdu/control-deck-core'
import { GameActionCategorySchema } from './actions.js'
import { CommandTargetSchema, type CommandTarget } from './commands.js'
import { NumpadShortcutCollectionSchema } from './numpad.js'

export const InputBackendModeSchema = z.enum(['auto', 'recording', 'linux-xdotool', 'windows-sendinput'])
export const PhoenixControlDeckThemeSchema = z.union([z.literal('phoenix'), ControlDeckColorSchemeSchema])

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
  theme: PhoenixControlDeckThemeSchema.default('phoenix'),
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

export function controlGridLayoutToControlDeckConfiguration (
  candidate: ControlGridLayout
): ControlDeckConfiguration {
  const layout = ControlGridLayoutSchema.parse(candidate)
  return ControlDeckConfigurationSchema.parse({
    version: 1,
    decks: layout.pages.map(page => ({
      id: page.id,
      name: page.label,
      description: '',
      context: `phoenix:${page.category}`,
      ...(page.theme === 'phoenix' ? {} : { appearance: { colorScheme: page.theme } }),
      layout: { kind: 'grid', columns: page.columns, rows: page.rows },
      elements: page.cells.map(cell => ({
        id: `cell_${cell.position}`,
        ...(cell.target
          ? {
              kind: 'command',
              target: phoenixTargetToControlDeckTarget(cell.target),
              appearance: {
                label: null,
                icon: null,
                foregroundColor: null,
                backgroundColor: null
              },
              interaction: { activation: 'command-default', confirmation: { kind: 'none' } }
            }
          : { kind: 'spacer' }),
        placement: {
          kind: 'grid',
          column: (cell.position - 1) % page.columns + 1,
          row: Math.floor((cell.position - 1) / page.columns) + 1,
          columnSpan: cell.span,
          rowSpan: 1
        }
      }))
    })),
    displays: []
  })
}

export function controlDeckConfigurationToControlGridLayout (
  candidate: ControlDeckConfiguration
): ControlGridLayout {
  const configuration = ControlDeckConfigurationSchema.parse(candidate)
  const groups = new Map((configuration.groups ?? []).map(group => [group.id, group]))
  return ControlGridLayoutSchema.parse({
    version: 4,
    pages: configuration.decks.flatMap(deck => {
      if (!deck.context?.startsWith('phoenix:')) return []
      const category = GameActionCategorySchema.parse(deck.context.slice('phoenix:'.length))
      if (deck.layout.kind !== 'grid') throw new Error(`PHOENIX deck ${deck.id} does not use a grid layout.`)
      return [{
        id: deck.id,
        label: (deck.groupId ? groups.get(deck.groupId)?.name : undefined) ?? deck.name,
        category,
        columns: deck.layout.columns,
        rows: deck.layout.rows,
        theme: (deck.groupId ? groups.get(deck.groupId)?.appearance : undefined)?.colorScheme ?? deck.appearance?.colorScheme ?? 'phoenix',
        cells: deck.elements.map(element => {
          if (element.placement.rowSpan !== 1) {
            throw new Error(`PHOENIX legacy controls cannot represent row-spanning element ${element.id}.`)
          }
          const position = (element.placement.row - 1) * deck.layout.columns + element.placement.column
          return {
            position,
            span: element.placement.columnSpan,
            target: element.kind === 'spacer' ? null : controlDeckTargetToPhoenixTarget(element.target)
          }
        })
      }]
    })
  })
}

export function mergeControlGridLayoutIntoControlDeckConfiguration (
  configurationCandidate: ControlDeckConfiguration,
  layoutCandidate: ControlGridLayout
): ControlDeckConfiguration {
  const configuration = ControlDeckConfigurationSchema.parse(configurationCandidate)
  controlDeckConfigurationToControlGridLayout(configuration)
  const replacement = controlGridLayoutToControlDeckConfiguration(layoutCandidate)
  const retainedDecks = configuration.decks.filter(deck => !deck.context?.startsWith('phoenix:'))
  const replacementDecks = replacement.decks.map(deck => {
    const previous = configuration.decks.find(candidate => candidate.id === deck.id)
    return previous?.groupId
      ? { ...deck, groupId: previous.groupId, name: previous.name, appearance: previous.appearance }
      : deck
  })
  const decks = [...replacementDecks, ...retainedDecks]
  const retainedGroupIds = new Set(decks.flatMap(deck => deck.groupId ? [deck.groupId] : []))
  return ControlDeckConfigurationSchema.parse({
    ...configuration,
    groups: configuration.groups?.filter(group => retainedGroupIds.has(group.id)),
    decks
  })
}

function phoenixTargetToControlDeckTarget (target: CommandTarget): ControlDeckCommandTarget {
  const commandId = target.type === 'game-action'
    ? `command.${target.actionId}`
    : target.type === 'navigation'
      ? `command.navigation.${target.destinationId}`
      : `command.macro.${target.macroId}`
  return { adapterId: 'phoenix.commands', commandId, configuration: {} }
}

function controlDeckTargetToPhoenixTarget (target: ControlDeckCommandTarget): CommandTarget {
  if (target.adapterId !== 'phoenix.commands' || Object.keys(target.configuration).length > 0) {
    throw new Error('PHOENIX legacy controls can represent only unconfigured PHOENIX command targets.')
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
    deckConfiguration: ControlDeckConfigurationSchema.default({ version: 1, decks: [], displays: [] })
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
export type PhoenixControlDeckTheme = z.infer<typeof PhoenixControlDeckThemeSchema>
export type { ControlDeckConfiguration }
export type PhoenixSettings = z.infer<typeof PhoenixSettingsSchema>
export type OpenAiConfigurationStatus = z.infer<typeof OpenAiConfigurationStatusSchema>
export type InstallationSettings = z.infer<typeof InstallationSettingsSchema>
export type InstallationSettingsUpdate = z.infer<typeof InstallationSettingsUpdateSchema>
export type OpenAiApiKeyRequest = z.infer<typeof OpenAiApiKeyRequestSchema>
export type RuntimeSystemSnapshot = z.infer<typeof RuntimeSystemSnapshotSchema>
