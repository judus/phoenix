import { z } from 'zod'
import { GalaxyBookmarkTargetSchema } from './bookmarks.js'

export const PersonalNoteTargetSchema = z.union([
  z.object({ kind: z.literal('mission'), missionId: z.number().int().nonnegative() }).strict(),
  GalaxyBookmarkTargetSchema
])
export const PersonalNoteWriteRequestSchema = z.object({
  title: z.string().trim().max(200).default(''),
  text: z.string().trim().max(16000).default(''),
  target: PersonalNoteTargetSchema.nullable()
}).strict()
export const PersonalNoteRecordSchema = PersonalNoteWriteRequestSchema.extend({
  id: z.string().uuid(),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
  createdBy: z.enum(['player', 'copilot']),
  updatedBy: z.enum(['player', 'copilot'])
}).strict()
export const PersonalNoteSchema = PersonalNoteRecordSchema.extend({ missionTitle: z.string().nullable() }).strict()
export const PersonalNotesResponseSchema = z.object({ notes: z.array(PersonalNoteSchema) }).strict()
export type PersonalNote = z.infer<typeof PersonalNoteSchema>
export type PersonalNoteRecord = z.infer<typeof PersonalNoteRecordSchema>
export type PersonalNoteTarget = z.infer<typeof PersonalNoteTargetSchema>
export type PersonalNoteWriteRequest = z.infer<typeof PersonalNoteWriteRequestSchema>
export type PersonalNotesResponse = z.infer<typeof PersonalNotesResponseSchema>
