import { z } from 'zod'

export const CommunicationViewSchema = z.enum(['inbox', 'traffic'])
export const CommunicationDirectionSchema = z.enum(['inbound', 'outbound'])
export const CommunicationSenderKindSchema = z.enum(['commander', 'npc', 'system', 'unknown'])

export const CommunicationMessageSchema = z.object({
  channel: z.string(),
  direction: CommunicationDirectionSchema,
  id: z.string().min(1),
  message: z.string(),
  rawMessage: z.string().nullable(),
  rawSender: z.string().nullable(),
  recipient: z.string().nullable(),
  sender: z.string().nullable(),
  senderKind: CommunicationSenderKindSchema,
  sourceEvent: z.enum(['ReceiveText', 'SendText']),
  timestamp: z.string().datetime({ offset: true }),
  view: CommunicationViewSchema
}).strict()

export const CommunicationContactSchema = z.object({
  channels: z.array(z.string()),
  id: z.string().min(1),
  inboundCount: z.number().int().nonnegative(),
  lastMessage: z.string().nullable(),
  lastSeenAt: z.string().datetime({ offset: true }),
  name: z.string(),
  outboundCount: z.number().int().nonnegative()
}).strict()

export const CommunicationsSummarySchema = z.object({
  inbound: z.number().int().nonnegative(),
  inbox: z.number().int().nonnegative(),
  outbound: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  traffic: z.number().int().nonnegative()
}).strict()

export const CommunicationsResponseSchema = z.object({
  contacts: z.array(CommunicationContactSchema),
  messages: z.array(CommunicationMessageSchema),
  summary: CommunicationsSummarySchema,
  view: z.enum(['all', 'inbox', 'traffic'])
}).strict()

export type CommunicationContact = z.infer<typeof CommunicationContactSchema>
export type CommunicationMessage = z.infer<typeof CommunicationMessageSchema>
export type CommunicationsResponse = z.infer<typeof CommunicationsResponseSchema>
export type CommunicationView = z.infer<typeof CommunicationViewSchema>
