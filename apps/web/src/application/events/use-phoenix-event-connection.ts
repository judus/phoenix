import { useSyncExternalStore } from 'react'
import type {
  PhoenixEventConnectionSnapshot,
  PhoenixEventHub
} from './phoenix-event-hub.js'

export function usePhoenixEventConnection(eventHub: PhoenixEventHub): PhoenixEventConnectionSnapshot {
  return useSyncExternalStore(
    eventHub.subscribeConnection,
    eventHub.getConnectionSnapshot,
    eventHub.getConnectionSnapshot
  )
}
