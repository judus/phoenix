import { z } from 'zod'
import { CommandIdSchema } from './commands.js'

export const ControlGridCellSchema = z.object({
  position: z.number().int().positive().max(128),
  span: z.number().int().min(1).max(12).default(1),
  commandId: CommandIdSchema.nullable()
})

export const ControlGridPageSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9_]*$/u),
  label: z.string().min(1).max(32),
  groupId: z.string().min(1).max(100),
  columns: z.number().int().min(2).max(12),
  rows: z.number().int().min(1).max(12).default(5),
  cells: z.array(ControlGridCellSchema).max(128)
}).superRefine((page, context) => {
  const capacity = page.columns * page.rows
  const occupied = new Set<number>()
  for (const cell of page.cells) {
    if (cell.position + cell.span - 1 > capacity) {
      context.addIssue({ code: 'custom', message: `Cell ${cell.position} exceeds the ${page.columns} x ${page.rows} grid.` })
    }
    if ((cell.position - 1) % page.columns + cell.span > page.columns) {
      context.addIssue({ code: 'custom', message: `Cell ${cell.position} crosses a row boundary.` })
    }
    for (let position = cell.position; position < cell.position + cell.span; position++) {
      if (occupied.has(position)) context.addIssue({ code: 'custom', message: `Grid position ${position} is occupied twice.` })
      occupied.add(position)
    }
  }
})

export const ControlGridLayoutSchema = z.object({
  version: z.literal(5),
  pages: z.array(ControlGridPageSchema).max(16)
}).superRefine((layout, context) => {
  const pageIds = new Set<string>()
  const groupIds = new Set<string>()
  for (const [index, page] of layout.pages.entries()) {
    if (pageIds.has(page.id)) context.addIssue({ code: 'custom', message: `Duplicate page id: ${page.id}.`, path: ['pages', index, 'id'] })
    if (groupIds.has(page.groupId)) context.addIssue({ code: 'custom', message: `Duplicate control group: ${page.groupId}.`, path: ['pages', index, 'groupId'] })
    pageIds.add(page.id)
    groupIds.add(page.groupId)
  }
})

export type ControlGridCell = z.infer<typeof ControlGridCellSchema>
export type ControlGridLayout = z.infer<typeof ControlGridLayoutSchema>
export type ControlGridPage = z.infer<typeof ControlGridPageSchema>
