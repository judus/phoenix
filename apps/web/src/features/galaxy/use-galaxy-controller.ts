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
  view: 'system' | 'atlas' | 'route' | 'database' | 'saved-queries' | 'bookmarks',
  systemName?: string
): GalaxyControllerSnapshot {
  const cacheKey = `galaxy:${view}:${systemName ?? ''}`
  const [snapshot, setSnapshot] = useState<GalaxyControllerSnapshot>(() =>
    readControllerSnapshot(api, cacheKey) ?? { status: 'idle' }
  )

  useEffect(() => {
    if (view === 'saved-queries' || view === 'bookmarks') {
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
        : view === 'atlas' || view === 'database'
            ? api.getNavigationRoute(signal).then(route => ({ route }))
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
    const unsubscribeRoute = view === 'route' || view === 'atlas' || view === 'database'
      ? events.subscribe('navigation-route', route => {
          latest.cancel()
          setSnapshot(current => storeControllerSnapshot(api, cacheKey, { ...current, route, error: undefined, status: 'ready' }))
        })
      : undefined
    const unsubscribeCartography = view === 'system'
      ? events.subscribe('cartography-updated', update => {
          if (!systemName || !sameSystemName(update.systemName, systemName)) return
          latest.cancel()
          publish({ lookup: { cache: 'local', system: update.system }, status: 'ready' })
        })
      : undefined
    const unsubscribeCatalogue = view === 'route'
      ? events.subscribe('command-catalogue', () => load())
      : undefined
    return () => {
      latest.cancel()
      unsubscribeRoute?.()
      unsubscribeCartography?.()
      unsubscribeCatalogue?.()
    }
  }, [api, cacheKey, events, systemName, view])

  return snapshot
}

function sameSystemName (left: string, right: string): boolean {
  return left.trim().toLocaleLowerCase() === right.trim().toLocaleLowerCase()
}
