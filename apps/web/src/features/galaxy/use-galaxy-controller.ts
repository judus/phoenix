import { useEffect, useState } from 'react'
import type { CartographyLookupResponse, NavigationRoute } from '@phoenix/contracts'
import type { PhoenixApi } from '../../application/api/phoenix-api.js'
import type { PhoenixEventHub } from '../../application/events/phoenix-event-hub.js'

export interface GalaxyControllerSnapshot {
  error?: string
  lookup?: CartographyLookupResponse
  route?: NavigationRoute
  status: 'idle' | 'loading' | 'ready' | 'error'
}

export function useGalaxyController(
  api: PhoenixApi,
  events: PhoenixEventHub,
  view: 'system' | 'route' | 'database',
  systemName?: string
): GalaxyControllerSnapshot {
  const [snapshot, setSnapshot] = useState<GalaxyControllerSnapshot>({ status: 'idle' })

  useEffect(() => {
    if (view === 'database') {
      setSnapshot({ status: 'ready' })
      return
    }

    const abort = new AbortController()
    let revision = 0
    const load = () => {
      const requestRevision = ++revision
      setSnapshot(current => ({ ...current, error: undefined, status: 'loading' }))
      const request = view === 'system'
        ? api.getSystemCartography(systemName, abort.signal).then(lookup => ({ lookup }))
        : api.getNavigationRoute(abort.signal).then(route => ({ route }))
      void request.then(result => {
        if (!abort.signal.aborted && requestRevision === revision) setSnapshot({ ...result, status: 'ready' })
      }).catch(cause => {
        if (abort.signal.aborted || requestRevision !== revision) return
        setSnapshot({
          error: cause instanceof Error ? cause.message : 'Galaxy data unavailable.',
          status: 'error'
        })
      })
    }

    load()
    const unsubscribe = view === 'route'
      ? events.subscribe('navigation-route', route => setSnapshot({ route, status: 'ready' }))
      : undefined
    return () => {
      abort.abort()
      unsubscribe?.()
    }
  }, [api, events, systemName, view])

  return snapshot
}
