import type { PhoenixApi } from './phoenix-api-client.js'

type PhoenixEventName =
  | 'activity-entry'
  | 'conversation-event'
  | 'command-catalogue'
  | 'copilot-profiles'
  | 'display-command'
  | 'runtime-state'
  | 'voice-host'
  | 'voice-host-command'

type Listener = (event: MessageEvent<string>) => void

interface SharedStream {
  listeners: Map<PhoenixEventName, Set<Listener>>
  source: EventSource
  url: string
}

let shared: SharedStream | undefined

export function subscribePhoenixEvent (
  api: PhoenixApi,
  eventName: PhoenixEventName,
  listener: Listener
): () => void {
  const url = api.eventStreamUrl()
  if (!shared || shared.url !== url) {
    shared?.source.close()
    shared = createSharedStream(url)
  }
  const stream = shared
  const listeners = stream.listeners.get(eventName) ?? new Set<Listener>()
  listeners.add(listener)
  stream.listeners.set(eventName, listeners)
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) stream.listeners.delete(eventName)
    if (stream.listeners.size === 0 && shared === stream) {
      stream.source.close()
      shared = undefined
    }
  }
}

function createSharedStream (url: string): SharedStream {
  const source = new EventSource(url)
  const stream: SharedStream = { listeners: new Map(), source, url }
  const names: PhoenixEventName[] = [
    'activity-entry',
    'conversation-event',
    'command-catalogue',
    'copilot-profiles',
    'display-command',
    'runtime-state',
    'voice-host',
    'voice-host-command'
  ]
  for (const name of names) {
    source.addEventListener(name, event => {
      for (const listener of stream.listeners.get(name) ?? []) {
        listener(event as MessageEvent<string>)
      }
    })
  }
  return stream
}
