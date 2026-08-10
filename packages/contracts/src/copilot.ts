import { z } from 'zod'

const NonEmptyTextSchema = z.string().trim().min(1)

export const CopilotChatRequestSchema = z.object({
  conversationId: NonEmptyTextSchema.optional(),
  message: NonEmptyTextSchema,
  profileId: NonEmptyTextSchema.optional()
}).strict()

export type CopilotChatRequest = z.infer<typeof CopilotChatRequestSchema>

export const CopilotHistoryMessageSchema = z.object({
  createdAt: z.string(),
  id: z.string(),
  role: z.enum(['assistant', 'system', 'user']),
  text: z.string()
})

export type CopilotHistoryMessage = z.infer<typeof CopilotHistoryMessageSchema>

export const CopilotHistoryResponseSchema = z.object({
  conversationId: z.string(),
  messages: z.array(CopilotHistoryMessageSchema)
})

export type CopilotHistoryResponse = z.infer<typeof CopilotHistoryResponseSchema>
