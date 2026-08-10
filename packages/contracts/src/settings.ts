import { z } from 'zod'
import { GameActionCategorySchema, GameActionDefinitionSchema } from './actions.js'

export const InputBackendModeSchema = z.enum(['auto', 'recording', 'linux-xdotool'])

const ControlGridCellSchema = z.object({
  position: z.number().int().positive().max(128),
  span: z.number().int().min(1).max(12).default(1),
  actionId: GameActionDefinitionSchema.shape.id.nullable()
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
  const actions = new Set<string>()

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
    if (cell.actionId) {
      if (actions.has(cell.actionId)) {
        context.addIssue({ code: 'custom', message: `${cell.actionId} is assigned twice on this page.` })
      }
      actions.add(cell.actionId)
    }
  }
})

export const ControlGridLayoutSchema = z.object({
  version: z.literal(2),
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
  controls: z.object({
    enabled: z.boolean(),
    backend: InputBackendModeSchema,
    layout: ControlGridLayoutSchema.default({ version: 2, pages: [] })
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
export type ControlGridLayout = z.infer<typeof ControlGridLayoutSchema>
export type PhoenixSettings = z.infer<typeof PhoenixSettingsSchema>
export type RuntimeSystemSnapshot = z.infer<typeof RuntimeSystemSnapshotSchema>
