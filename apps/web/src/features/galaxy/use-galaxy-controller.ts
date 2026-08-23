import { useEffect, useState } from 'react'
import type { CartographyLookupResponse, GameActionCatalogResponse, NavigationRoute } from '@phoenix/contracts'
import type { PhoenixApi } from '../../application/api/phoenix-api.js'
import { readControllerSnapshot, storeControllerSnapshot } from '../../application/cache/controller-snapshot-cache.js'
import type { PhoenixEventHub } from '../../application/events/phoenix-event-hub.js'
import { LatestRequest } from '../../application/requests/latest-request.js'

export interface GalaxyControllerSnapshot {
  actions?: GameActionCatalogResponse
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
  const cacheKey = `galaxy:${view}:${systemName ?? ''}`
  const [snapshot, setSnapshot] = useState<GalaxyControllerSnapshot>(() =>
    readControllerSnapshot(api, cacheKey) ?? { status: 'idle' }
  )

  useEffect(() => {
    if (view === 'database') {
      setSnapshot({ status: 'ready' })
      return
    }

    const latest = new LatestRequest()
    const retained = readControllerSnapshot<GalaxyControllerSnapshot>(api, cacheKey)
    const publish = (next: GalaxyControllerSnapshot) => setSnapshot(storeControllerSnapshot(api, cacheKey, next))
    const load = (showLoading = false) => {
      const signal = latest.start()
      if (showLoading) setSnapshot(retained ?? { status: 'loading' })
      const request = view === 'system'
        ? api.getSystemCartography(systemName, signal).then(lookup => ({ lookup }))
        : Promise.all([api.getNavigationRoute(signal), api.getActions(signal)])
          .then(([route, actions]) => ({ actions, route }))
      void request.then(result => {
        if (latest.isCurrent(signal)) publish({ ...result, status: 'ready' })
      }).catch(cause => {
        if (!latest.isCurrent(signal)) return
        const error = cause instanceof Error ? cause.message : 'Galaxy data unavailable.'
        setSnapshot(current => current.status === 'ready' ? { ...current, error } : { error, status: 'error' })
      })
    }

    load(true)
    const unsubscribeRoute = view === 'route'
      ? events.subscribe('navigation-route', route => {
          latest.cancel()
          setSnapshot(current => storeControllerSnapshot(api, cacheKey, { ...current, route, status: 'ready' }))
        })
      : undefined
    const unsubscribeCatalogue = view === 'route'
      ? events.subscribe('command-catalogue', () => load())
      : undefined
    return () => {
      latest.cancel()
      unsubscribeRoute?.()
      unsubscribeCatalogue?.()
    }
  }, [api, cacheKey, events, systemName, view])

  return snapshot
}
