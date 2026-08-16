import { useSyncExternalStore } from 'react'
import type { PhoenixRoute } from './phoenix-route.js'
import type { PhoenixRouter } from './phoenix-router.js'

export function usePhoenixRoute(router: PhoenixRouter): PhoenixRoute {
  return useSyncExternalStore(router.subscribe, router.getSnapshot, router.getSnapshot)
}
