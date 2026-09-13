import {
  LocalTrafficResponseSchema,
  type CommunicationMessage,
  type LocalTrafficResponse
} from '@phoenix/contracts'
import type { CommunicationRepository, LocalTrafficReader } from '../domain/communications.js'

export const LOCAL_TRAFFIC_WINDOW_MINUTES = 90
const CANDIDATE_LIMIT = 250
const AMBIENT_REPEAT_WINDOW_MINUTES = 10

export class LocalTrafficService implements LocalTrafficReader {
  public constructor (
    private readonly repository: CommunicationRepository,
    private readonly now: () => Date = () => new Date()
  ) {}

  public getLocalTraffic (limit = 5): LocalTrafficResponse {
    const generatedAt = this.now()
    const cutoff = generatedAt.getTime() - LOCAL_TRAFFIC_WINDOW_MINUTES * 60_000
    const boundedLimit = Math.min(Math.max(Math.trunc(limit), 1), 12)
    const recent = this.repository.listCommunicationMessages('all', CANDIDATE_LIMIT)
      .filter(message => Date.parse(message.timestamp) >= cutoff)
      .sort(compareNewest)
    const selected = prioritize(deduplicateAmbient(recent))
      .slice(0, boundedLimit)
      .sort(compareNewest)

    return LocalTrafficResponseSchema.parse({
      generatedAt: generatedAt.toISOString(),
      messages: selected,
      schemaVersion: 1,
      windowMinutes: LOCAL_TRAFFIC_WINDOW_MINUTES
    })
  }
}

function deduplicateAmbient (messages: CommunicationMessage[]): CommunicationMessage[] {
  const latestByMessage = new Map<string, number>()
  return messages.filter(message => {
    if (isPersonal(message)) return true
    const key = [message.channel, message.senderKind, message.sender, message.recipient, message.message]
      .map(value => value?.toLowerCase() ?? '')
      .join('\u0000')
    const timestamp = Date.parse(message.timestamp)
    const latest = latestByMessage.get(key)
    if (latest !== undefined && latest - timestamp <= AMBIENT_REPEAT_WINDOW_MINUTES * 60_000) return false
    latestByMessage.set(key, timestamp)
    return true
  })
}

function prioritize (messages: CommunicationMessage[]): CommunicationMessage[] {
  return [...messages].sort((left, right) => {
    const priority = messagePriority(left) - messagePriority(right)
    return priority === 0 ? compareNewest(left, right) : priority
  })
}

function messagePriority (message: CommunicationMessage): number {
  if (message.view === 'inbox') return 0
  if (message.senderKind === 'commander') return 1
  return 2
}

function isPersonal (message: CommunicationMessage): boolean {
  return message.view === 'inbox' || message.senderKind === 'commander'
}

function compareNewest (left: CommunicationMessage, right: CommunicationMessage): number {
  return right.timestamp.localeCompare(left.timestamp) || right.id.localeCompare(left.id)
}
