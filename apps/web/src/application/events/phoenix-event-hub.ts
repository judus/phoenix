import type {
  ActivityLogEntry,
  CommandCatalogueRevision,
  CopilotConversationEvent,
  CopilotProfilesResponse,
  CopilotVoiceHostCommand,
  CopilotVoiceHostSnapshot,
  DisplayCommand,
  NavigationRoute,
  RuntimeState
} from '@phoenix/contracts'

export interface PhoenixEventMap {
  'activity-entry': ActivityLogEntry
  'command-catalogue': CommandCatalogueRevision
  'conversation-event': CopilotConversationEvent
  'copilot-profiles': CopilotProfilesResponse
  'display-command': DisplayCommand
  'navigation-route': NavigationRoute
  'runtime-state': RuntimeState
  'voice-host': CopilotVoiceHostSnapshot
  'voice-host-command': CopilotVoiceHostCommand
}

export type PhoenixEventName = keyof PhoenixEventMap

export interface PhoenixEventConnectionSnapshot {
  state: 'idle' | 'connecting' | 'open' | 'error'
  error?: string
}

export interface PhoenixEventHub {
  getConnectionSnapshot(): PhoenixEventConnectionSnapshot
  start(): void
  stop(): void
  subscribe<K extends PhoenixEventName>(
    eventName: K,
    listener: (payload: PhoenixEventMap[K]) => void
  ): () => void
  subscribeConnection(listener: () => void): () => void
}
