import { createHash } from 'node:crypto'
import {
  CommunicationMessageSchema,
  CommunicationsResponseSchema,
  type CommunicationContact,
  type CommunicationMessage,
  type CommunicationsResponse
} from '@phoenix/contracts'
import type { EliteJournalEvent } from '@phoenix/elite'
import type { CommunicationDataReader, CommunicationQueryView, CommunicationRepository } from '../domain/communications.js'

const inboxChannels = new Set(['player', 'friend', 'wing', 'team', 'squadron', 'crew'])

export class CommunicationDataService implements CommunicationDataReader {
  public constructor (private readonly repository: CommunicationRepository) {}

  public ingest (event: EliteJournalEvent): void {
    if (event.event !== 'ReceiveText' && event.event !== 'SendText') return
    const message = normalizeMessage(event)
    if (message) this.repository.putCommunicationMessage(message)
  }

  public getCommunications (view: CommunicationQueryView = 'all', limit = 250): CommunicationsResponse {
    const boundedLimit = Math.min(Math.max(limit, 1), 1000)
    const messages = this.repository.listCommunicationMessages(view, boundedLimit)
    const contactEvidence = this.repository.listCommunicationMessages('all', 5000)
      .filter(message => message.senderKind === 'commander' && message.sender)
    return CommunicationsResponseSchema.parse({
      contacts: contactsFrom(contactEvidence),
      messages,
      summary: this.repository.summarizeCommunications(),
      view
    })
  }
}

function normalizeMessage (event: EliteJournalEvent): CommunicationMessage | null {
  const direction = event.event === 'ReceiveText' ? 'inbound' : 'outbound'
  const rawMessage = text(event.Message)
  const message = text(event.Message_Localised) ?? rawMessage
  if (!message) return null
  const channel = (text(event.Channel) ?? text(event.To) ?? 'unknown').toLowerCase()
  const rawSender = direction === 'inbound' ? text(event.From) : null
  const sender = direction === 'inbound' ? text(event.From_Localised) ?? rawSender : null
  const recipient = direction === 'outbound' ? text(event.To_Localised) ?? text(event.To) : null
  const view = inboxChannels.has(channel) ? 'inbox' : 'traffic'
  const senderKind = direction === 'outbound'
    ? 'commander'
    : channel === 'npc'
      ? 'npc'
      : sender
        ? 'commander'
        : rawMessage?.startsWith('$') === true
          ? 'system'
          : 'unknown'
  const fingerprint = JSON.stringify({ channel, direction, message, rawMessage, rawSender, recipient, sender, timestamp: event.timestamp })
  return CommunicationMessageSchema.parse({
    channel,
    direction,
    id: createHash('sha256').update(fingerprint).digest('hex'),
    message,
    rawMessage,
    rawSender,
    recipient,
    sender,
    senderKind,
    sourceEvent: event.event,
    timestamp: event.timestamp,
    view
  })
}

function contactsFrom (messages: CommunicationMessage[]): CommunicationContact[] {
  const contacts = new Map<string, CommunicationContact>()
  for (const message of messages) {
    if (!message.sender) continue
    const id = message.sender.toLocaleLowerCase()
    const existing = contacts.get(id)
    const channels = [...new Set([...(existing?.channels ?? []), message.channel])].sort()
    contacts.set(id, {
      channels,
      id,
      inboundCount: (existing?.inboundCount ?? 0) + Number(message.direction === 'inbound'),
      lastMessage: !existing || message.timestamp > existing.lastSeenAt ? message.message : existing.lastMessage,
      lastSeenAt: !existing || message.timestamp > existing.lastSeenAt ? message.timestamp : existing.lastSeenAt,
      name: message.sender,
      outboundCount: (existing?.outboundCount ?? 0) + Number(message.direction === 'outbound')
    })
  }
  return [...contacts.values()].sort((left, right) => right.lastSeenAt.localeCompare(left.lastSeenAt))
}

function text (value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}
