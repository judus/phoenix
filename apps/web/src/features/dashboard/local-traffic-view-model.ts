import type { CommunicationMessage } from '@phoenix/contracts'

export interface LocalTrafficItemViewModel {
  channel: string
  correspondent: string
  id: string
  message: string
  relativeTime: string
  scope: string
  timestamp: string
}

export function createLocalTrafficViewModel (
  messages: readonly CommunicationMessage[],
  now = new Date()
): LocalTrafficItemViewModel[] {
  return messages.map(message => ({
    channel: channelLabel(message.channel),
    correspondent: correspondent(message),
    id: message.id,
    message: message.message,
    relativeTime: formatRelativeTime(message.timestamp, now),
    scope: scopeLabel(message),
    timestamp: message.timestamp
  }))
}

function correspondent (message: CommunicationMessage): string {
  if (message.direction === 'outbound') {
    return message.recipient ? `To ${message.recipient}` : 'Outgoing message'
  }
  return message.sender ?? {
    commander: 'Commander',
    npc: 'Local contact',
    system: 'System',
    unknown: 'Unknown source'
  }[message.senderKind]
}

function scopeLabel (message: CommunicationMessage): string {
  if (message.view === 'inbox') {
    return message.channel === 'player' || message.channel === 'friend' ? 'Direct' : 'Group'
  }
  return {
    commander: 'Commander',
    npc: 'NPC',
    system: 'System',
    unknown: 'Traffic'
  }[message.senderKind]
}

function channelLabel (channel: string): string {
  const known = {
    friend: 'Friend',
    local: 'Local',
    npc: 'NPC',
    player: 'Direct',
    squadron: 'Squadron',
    starsystem: 'Star system',
    voicechat: 'Voice chat',
    wing: 'Wing'
  }[channel]
  if (known) return known
  return channel
    .replace(/([a-z])([A-Z])/gu, '$1 $2')
    .replace(/^./u, character => character.toLocaleUpperCase())
}

function formatRelativeTime (value: string, now: Date): string {
  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp)) return 'Time unknown'
  const elapsedSeconds = Math.max(0, Math.floor((now.getTime() - timestamp) / 1_000))
  if (elapsedSeconds < 60) return 'Now'
  const minutes = Math.floor(elapsedSeconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  return `${hours} ${hours === 1 ? 'hr' : 'hrs'} ago`
}
