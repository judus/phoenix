import { z } from 'zod'

export const GalaxyBookmarkTargetSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('system'),
    systemName: z.string().trim().min(1)
  }).strict(),
  z.object({
    bodyName: z.string().trim().min(1),
    kind: z.literal('body'),
    systemName: z.string().trim().min(1)
  }).strict()
])

export const GalaxyBookmarkWriteRequestSchema = z.object({
  note: z.string().trim().nullable(),
  tags: z.array(z.string().trim().min(1)),
  target: GalaxyBookmarkTargetSchema
}).strict()

export const GalaxyBookmarkSchema = GalaxyBookmarkWriteRequestSchema.extend({
  createdAt: z.string().datetime({ offset: true }),
  id: z.string().uuid(),
  updatedAt: z.string().datetime({ offset: true })
}).strict()

export const GalaxyBookmarksResponseSchema = z.object({
  bookmarks: z.array(GalaxyBookmarkSchema)
}).strict()

export type GalaxyBookmark = z.infer<typeof GalaxyBookmarkSchema>
export type GalaxyBookmarkTarget = z.infer<typeof GalaxyBookmarkTargetSchema>
export type GalaxyBookmarkWriteRequest = z.infer<typeof GalaxyBookmarkWriteRequestSchema>
export type GalaxyBookmarksResponse = z.infer<typeof GalaxyBookmarksResponseSchema>
