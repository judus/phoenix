import type {
  ActivityLogEntry,
  CartographyUpdate,
  CommandCatalogueRevision,
  CommunicationMessage,
  CommanderLogEntry,
  CopilotConversationEvent,
  CopilotProfilesResponse,
  CopilotVoiceHostCommand,
  CopilotVoiceHostSnapshot,
  DisplayCommand,
  EngineeringProjectsChanged,
  NavigationRoute,
  RuntimeState
} from '@phoenix/contracts'

export interface PhoenixEventMap {
  'activity-entry': ActivityLogEntry
  'cartography-updated': CartographyUpdate
  'command-catalogue': CommandCatalogueRevision
  'communication-message': CommunicationMessage
  'commander-log-entry': CommanderLogEntry
  'conversation-event': CopilotConversationEvent
  'copilot-profiles': CopilotProfilesResponse
  'display-command': DisplayCommand
  'engineering-projects-changed': EngineeringProjectsChanged
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
