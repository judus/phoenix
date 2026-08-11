import { z } from 'zod'

const NonEmptyTextSchema = z.string().trim().min(1)

export const CopilotChatRequestSchema = z.object({
  clientId: NonEmptyTextSchema.optional(),
  conversationId: NonEmptyTextSchema.optional(),
  message: NonEmptyTextSchema,
  profileId: NonEmptyTextSchema.optional(),
  turnId: NonEmptyTextSchema.optional()
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

export const CopilotRealtimeTokenRequestSchema = z.object({
  conversationId: NonEmptyTextSchema.optional(),
  profileId: NonEmptyTextSchema.optional()
}).strict()

export const CopilotRealtimeTokenResponseSchema = z.object({
  value: NonEmptyTextSchema,
  model: NonEmptyTextSchema,
  expiresAt: z.number().int().optional()
})

export const CopilotRealtimeTurnRequestSchema = z.object({
  assistantText: NonEmptyTextSchema,
  clientId: NonEmptyTextSchema.optional(),
  conversationId: NonEmptyTextSchema,
  source: z.enum(['transcribed', 'typed']),
  turnId: NonEmptyTextSchema,
  userText: NonEmptyTextSchema
}).strict()

const CopilotConversationEventBaseSchema = z.object({
  clientId: NonEmptyTextSchema,
  conversationId: NonEmptyTextSchema,
  occurredAt: z.string().datetime(),
  turnId: NonEmptyTextSchema
})

export const CopilotConversationEventSchema = z.discriminatedUnion('type', [
  CopilotConversationEventBaseSchema.extend({
    source: z.enum(['realtime', 'text']),
    type: z.literal('turn.started'),
    userText: z.string()
  }).strict(),
  CopilotConversationEventBaseSchema.extend({
    final: z.boolean(),
    text: z.string(),
    type: z.literal('user.transcript')
  }).strict(),
  CopilotConversationEventBaseSchema.extend({
    final: z.boolean(),
    text: z.string(),
    type: z.literal('assistant.transcript')
  }).strict(),
  CopilotConversationEventBaseSchema.extend({
    callId: NonEmptyTextSchema,
    name: NonEmptyTextSchema.optional(),
    status: NonEmptyTextSchema,
    type: z.literal('tool.status')
  }).strict(),
  CopilotConversationEventBaseSchema.extend({
    type: z.literal('turn.completed')
  }).strict(),
  CopilotConversationEventBaseSchema.extend({
    message: NonEmptyTextSchema,
    type: z.literal('turn.failed')
  }).strict()
])

export type CopilotConversationEvent = z.infer<typeof CopilotConversationEventSchema>

export const CopilotRealtimeToolRequestSchema = z.object({
  arguments: z.record(z.string(), z.unknown()).default({}),
  name: NonEmptyTextSchema
}).strict()

const AudioFilterSchema = z.object({
  enabled: z.boolean(),
  frequencyHz: z.number().min(20).max(20_000),
  q: z.number().positive().max(100)
})

export const CopilotAudioProcessingSchema = z.object({
  enabled: z.boolean(),
  filters: z.object({
    highpass: AudioFilterSchema,
    lowpass: AudioFilterSchema,
    presence: AudioFilterSchema.extend({ gainDb: z.number().min(-40).max(40) })
  }),
  saturation: z.object({ enabled: z.boolean(), amount: z.number().min(0).max(1) }),
  compressor: z.object({
    enabled: z.boolean(),
    thresholdDb: z.number().min(-100).max(0),
    kneeDb: z.number().min(0).max(40),
    ratio: z.number().min(1).max(20),
    attackSeconds: z.number().min(0).max(1),
    releaseSeconds: z.number().min(0).max(1)
  }),
  room: z.object({
    enabled: z.boolean(),
    mix: z.number().min(0).max(1),
    durationSeconds: z.number().min(0.01).max(1),
    decay: z.number().min(0.1).max(20)
  }),
  reflection: z.object({
    enabled: z.boolean(),
    delaySeconds: z.number().min(0.005).max(0.15),
    gain: z.number().min(0).max(0.5)
  }),
  outputGain: z.number().min(0).max(2)
}).superRefine((config, context) => {
  if (config.filters.highpass.frequencyHz >= config.filters.lowpass.frequencyHz) {
    context.addIssue({
      code: 'custom',
      message: 'High-pass frequency must be lower than low-pass frequency.',
      path: ['filters', 'highpass', 'frequencyHz']
    })
  }
})

export type CopilotAudioProcessing = z.infer<typeof CopilotAudioProcessingSchema>
export type CopilotRealtimeTokenRequest = z.infer<typeof CopilotRealtimeTokenRequestSchema>
export type CopilotRealtimeTokenResponse = z.infer<typeof CopilotRealtimeTokenResponseSchema>
export type CopilotRealtimeToolRequest = z.infer<typeof CopilotRealtimeToolRequestSchema>
export type CopilotRealtimeTurnRequest = z.infer<typeof CopilotRealtimeTurnRequestSchema>
