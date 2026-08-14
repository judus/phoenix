import { z } from 'zod'

const NonEmptyTextSchema = z.string().trim().min(1)

export const CopilotProfileSchema = z.object({
  description: z.string().trim().max(240).default(''),
  id: z.string().regex(/^[a-z][a-z0-9_-]*$/u),
  mark: z.string().trim().min(1).max(3),
  name: NonEmptyTextSchema.max(48),
  voice: NonEmptyTextSchema
}).strict()

export const CopilotProfilesResponseSchema = z.object({
  activeProfileId: CopilotProfileSchema.shape.id,
  profiles: z.array(CopilotProfileSchema).min(1)
}).strict()

export const CopilotProfileSelectionRequestSchema = z.object({
  profileId: CopilotProfileSchema.shape.id
}).strict()

export const CopilotProfileDocumentSchema = z.object({
  characterSpeech: NonEmptyTextSchema,
  characterText: NonEmptyTextSchema,
  profile: CopilotProfileSchema
}).strict()

export const CopilotProfileWriteRequestSchema = CopilotProfileDocumentSchema.extend({
  templateProfileId: CopilotProfileSchema.shape.id.optional()
}).strict()

export type CopilotProfile = z.infer<typeof CopilotProfileSchema>
export type CopilotProfilesResponse = z.infer<typeof CopilotProfilesResponseSchema>
export type CopilotProfileSelectionRequest = z.infer<typeof CopilotProfileSelectionRequestSchema>
export type CopilotProfileDocument = z.infer<typeof CopilotProfileDocumentSchema>
export type CopilotProfileWriteRequest = z.infer<typeof CopilotProfileWriteRequestSchema>

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
    type: z.literal('turn.cancelled')
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

export const CopilotVoiceHostPhaseSchema = z.enum([
  'offline',
  'ready',
  'connecting',
  'listening',
  'thinking',
  'speaking',
  'acting',
  'error'
])

export const CopilotVoiceHostHeartbeatSchema = z.object({
  armed: z.literal(true),
  clientId: NonEmptyTextSchema,
  connected: z.boolean(),
  error: z.string().optional(),
  hostId: NonEmptyTextSchema,
  phase: CopilotVoiceHostPhaseSchema
}).strict()

export const CopilotVoiceHostStatusSchema = CopilotVoiceHostHeartbeatSchema.extend({
  lastSeenAt: z.string().datetime()
}).strict()

export const CopilotVoiceHostSnapshotSchema = z.object({
  desiredConnected: z.boolean(),
  host: CopilotVoiceHostStatusSchema.nullable()
}).strict()

export const CopilotVoiceHostDesiredStateRequestSchema = z.object({
  connected: z.boolean()
}).strict()

export const CopilotVoiceHostCommandSchema = z.object({
  desiredConnected: z.boolean(),
  hostId: NonEmptyTextSchema,
  issuedAt: z.string().datetime(),
  requestId: NonEmptyTextSchema
}).strict()

export const CopilotVoiceHostCommandAcceptedSchema = z.object({
  accepted: z.literal(true),
  command: CopilotVoiceHostCommandSchema
}).strict()

export type CopilotVoiceHostHeartbeat = z.infer<typeof CopilotVoiceHostHeartbeatSchema>
export type CopilotVoiceHostStatus = z.infer<typeof CopilotVoiceHostStatusSchema>
export type CopilotVoiceHostSnapshot = z.infer<typeof CopilotVoiceHostSnapshotSchema>
export type CopilotVoiceHostDesiredStateRequest = z.infer<typeof CopilotVoiceHostDesiredStateRequestSchema>
export type CopilotVoiceHostCommand = z.infer<typeof CopilotVoiceHostCommandSchema>
export type CopilotVoiceHostCommandAccepted = z.infer<typeof CopilotVoiceHostCommandAcceptedSchema>
