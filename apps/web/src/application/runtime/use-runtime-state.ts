import { useSyncExternalStore } from 'react'
import type { RuntimeStateSnapshot, RuntimeStateStore } from './runtime-state-store.js'

export function useRuntimeState(store: RuntimeStateStore): RuntimeStateSnapshot {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
}
