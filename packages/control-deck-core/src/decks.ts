import { z } from 'zod'
import { ControlDeckCommandTargetSchema } from './commands.js'

const EntityIdSchema = z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/u)
const HexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?$/u)

export const ControlDeckElementAppearanceSchema = z.object({
  label: z.string().min(1).max(80).nullable().default(null),
  icon: z.string().min(1).max(200).nullable().default(null),
  foregroundColor: HexColorSchema.nullable().default(null),
  backgroundColor: HexColorSchema.nullable().default(null)
})

export const ControlDeckColorSchemeSchema = z.enum([
  'blue',
  'cyan',
  'green',
  'amber',
  'orange',
  'red',
  'violet',
  'magenta'
])

export const ControlDeckDeckAppearanceSchema = z.object({
  colorScheme: ControlDeckColorSchemeSchema
})

export const ControlDeckDeckGroupSchema = z.object({
  id: EntityIdSchema,
  name: z.string().min(1).max(80),
  description: z.string().max(500).default(''),
  appearance: ControlDeckDeckAppearanceSchema.optional()
})

export const ControlDeckInteractionSchema = z.object({
  activation: z.enum(['command-default', 'tap', 'hold']).default('command-default'),
  confirmation: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('none') }),
    z.object({
      kind: z.literal('arm-then-tap'),
      armedForMs: z.number().int().min(1_000).max(30_000).default(5_000)
    })
  ]).default({ kind: 'none' })
})

export const ControlDeckGridPlacementSchema = z.object({
  kind: z.literal('grid'),
  column: z.number().int().positive(),
  row: z.number().int().positive(),
  columnSpan: z.number().int().positive().max(24).default(1),
  rowSpan: z.number().int().positive().max(24).default(1)
})

export const ControlDeckCommandElementSchema = z.object({
  id: EntityIdSchema,
  kind: z.literal('command'),
  target: ControlDeckCommandTargetSchema,
  placement: ControlDeckGridPlacementSchema,
  appearance: ControlDeckElementAppearanceSchema.default({
    label: null,
    icon: null,
    foregroundColor: null,
    backgroundColor: null
  }),
  interaction: ControlDeckInteractionSchema.default({
    activation: 'command-default',
    confirmation: { kind: 'none' }
  })
})

export const ControlDeckSpacerElementSchema = z.object({
  id: EntityIdSchema,
  kind: z.literal('spacer'),
  placement: ControlDeckGridPlacementSchema
})

export const ControlDeckElementSchema = z.discriminatedUnion('kind', [
  ControlDeckCommandElementSchema,
  ControlDeckSpacerElementSchema
])

export const ControlDeckGridLayoutSchema = z.object({
  kind: z.literal('grid'),
  columns: z.number().int().min(1).max(24),
  rows: z.number().int().min(1).max(24)
})

export const ControlDeckDeckSchema = z.object({
  id: EntityIdSchema,
  groupId: EntityIdSchema.nullable().optional(),
  name: z.string().min(1).max(80),
  description: z.string().max(500).default(''),
  context: z.string().min(1).max(100).nullable().default(null),
  appearance: ControlDeckDeckAppearanceSchema.optional(),
  layout: ControlDeckGridLayoutSchema,
  elements: z.array(ControlDeckElementSchema).max(512)
}).superRefine((deck, context) => {
  const elementIds = new Set<string>()
  const occupied = new Map<string, string>()
  for (const element of deck.elements) {
    if (elementIds.has(element.id)) {
      context.addIssue({ code: 'custom', message: `Duplicate element id in deck ${deck.id}: ${element.id}.` })
    }
    elementIds.add(element.id)
    const placement = element.placement
    if (placement.column + placement.columnSpan - 1 > deck.layout.columns ||
        placement.row + placement.rowSpan - 1 > deck.layout.rows) {
      context.addIssue({ code: 'custom', message: `Element ${element.id} exceeds deck ${deck.id}.` })
      continue
    }
    for (let row = placement.row; row < placement.row + placement.rowSpan; row++) {
      for (let column = placement.column; column < placement.column + placement.columnSpan; column++) {
        const position = `${column}:${row}`
        const previous = occupied.get(position)
        if (previous) {
          context.addIssue({
            code: 'custom',
            message: `Elements ${previous} and ${element.id} overlap in deck ${deck.id}.`
          })
        }
        occupied.set(position, element.id)
      }
    }
  }
})

export const ControlDeckDisplaySchema = z.object({
  id: EntityIdSchema,
  name: z.string().min(1).max(80),
  deckId: EntityIdSchema.nullable(),
  order: z.number().int().nonnegative().default(0)
})

export const ControlDeckConfigurationSchema = z.object({
  version: z.literal(1),
  groups: z.array(ControlDeckDeckGroupSchema).max(256).optional(),
  decks: z.array(ControlDeckDeckSchema).max(256),
  displays: z.array(ControlDeckDisplaySchema).max(64)
}).superRefine((configuration, context) => {
  const groupIds = new Set<string>()
  for (const group of configuration.groups ?? []) {
    if (groupIds.has(group.id)) context.addIssue({ code: 'custom', message: `Duplicate deck group id: ${group.id}.` })
    groupIds.add(group.id)
  }
  const deckIds = new Set<string>()
  const populatedGroupIds = new Set<string>()
  for (const deck of configuration.decks) {
    if (deckIds.has(deck.id)) context.addIssue({ code: 'custom', message: `Duplicate deck id: ${deck.id}.` })
    deckIds.add(deck.id)
    if (deck.groupId && !groupIds.has(deck.groupId)) {
      context.addIssue({ code: 'custom', message: `Deck ${deck.id} references unknown group ${deck.groupId}.` })
    }
    if (deck.groupId) populatedGroupIds.add(deck.groupId)
  }
  for (const group of configuration.groups ?? []) {
    if (!populatedGroupIds.has(group.id)) {
      context.addIssue({ code: 'custom', message: `Deck group ${group.id} has no subdecks.` })
    }
  }
  const displayIds = new Set<string>()
  for (const display of configuration.displays) {
    if (displayIds.has(display.id)) {
      context.addIssue({ code: 'custom', message: `Duplicate display id: ${display.id}.` })
    }
    displayIds.add(display.id)
    if (display.deckId !== null && !deckIds.has(display.deckId)) {
      context.addIssue({ code: 'custom', message: `Display ${display.id} references unknown deck ${display.deckId}.` })
    }
  }
})

export type ControlDeckElementAppearance = z.infer<typeof ControlDeckElementAppearanceSchema>
export type ControlDeckColorScheme = z.infer<typeof ControlDeckColorSchemeSchema>
export type ControlDeckDeckAppearance = z.infer<typeof ControlDeckDeckAppearanceSchema>
export type ControlDeckDeckGroup = z.infer<typeof ControlDeckDeckGroupSchema>
export type ControlDeckInteraction = z.infer<typeof ControlDeckInteractionSchema>
export type ControlDeckGridPlacement = z.infer<typeof ControlDeckGridPlacementSchema>
export type ControlDeckCommandElement = z.infer<typeof ControlDeckCommandElementSchema>
export type ControlDeckSpacerElement = z.infer<typeof ControlDeckSpacerElementSchema>
export type ControlDeckElement = z.infer<typeof ControlDeckElementSchema>
export type ControlDeckGridLayout = z.infer<typeof ControlDeckGridLayoutSchema>
export type ControlDeckDeck = z.infer<typeof ControlDeckDeckSchema>
export type ControlDeckDisplay = z.infer<typeof ControlDeckDisplaySchema>
export type ControlDeckConfiguration = z.infer<typeof ControlDeckConfigurationSchema>

export interface ControlDeckConfigurationRepository {
  getConfiguration(): ControlDeckConfiguration
  saveConfiguration(configuration: ControlDeckConfiguration): ControlDeckConfiguration
}
