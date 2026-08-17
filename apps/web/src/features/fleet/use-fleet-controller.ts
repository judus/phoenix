import { useEffect, useState } from 'react'
import type { FleetResponse, GameActionCatalogResponse, ShipDefinition } from '@phoenix/contracts'
import type { PhoenixApi } from '../../application/api/phoenix-api.js'
import { readControllerSnapshot, storeControllerSnapshot } from '../../application/cache/controller-snapshot-cache.js'
import type { PhoenixEventHub } from '../../application/events/phoenix-event-hub.js'
import { LatestRequest } from '../../application/requests/latest-request.js'

export type FleetView = 'overview' | 'current-overview' | 'current-loadout' | 'current-cargo' | 'current-engineering' | 'carriers' | 'stored-modules' | 'catalogue'

export interface FleetControllerSnapshot {
  actions?: GameActionCatalogResponse
  catalogue?: readonly ShipDefinition[]
  error?: string
  fleet?: FleetResponse
  status: 'idle' | 'loading' | 'ready' | 'error'
}

export function useFleetController(api: PhoenixApi, events: PhoenixEventHub, view: FleetView): FleetControllerSnapshot {
  const cacheKey = `fleet:${view}`
  const [snapshot, setSnapshot] = useState<FleetControllerSnapshot>(() =>
    readControllerSnapshot(api, cacheKey) ?? { status: 'idle' }
  )

  useEffect(() => {
    const needsFleet = view === 'overview' || view === 'carriers' || view === 'stored-modules'
    const needsCatalogue = view === 'catalogue'
    const needsActions = view === 'current-overview'
    if (!needsFleet && !needsCatalogue && !needsActions) {
      setSnapshot({ status: 'idle' })
      return
    }

    const latest = new LatestRequest()
    const retained = readControllerSnapshot<FleetControllerSnapshot>(api, cacheKey)
    const publish = (next: FleetControllerSnapshot) => setSnapshot(storeControllerSnapshot(api, cacheKey, next))
    const load = (showLoading = false) => {
      const signal = latest.start()
      if (showLoading) setSnapshot(retained ?? { status: 'loading' })
      const fail = (cause: unknown) => {
        if (!latest.isCurrent(signal)) return
        const error = cause instanceof Error ? cause.message : 'Fleet data unavailable.'
        setSnapshot(current => current.status === 'ready' ? { ...current, error } : { error, status: 'error' })
      }
      if (needsFleet) {
        void api.getFleet(signal).then(fleet => {
          if (latest.isCurrent(signal)) publish({ fleet, status: 'ready' })
        }).catch(fail)
        return
      }
      if (needsActions) {
        void api.getActions(signal).then(actions => {
          if (latest.isCurrent(signal)) publish({ actions, status: 'ready' })
        }).catch(fail)
        return
      }
      void api.getShipCatalogue(signal).then(catalogue => {
        if (latest.isCurrent(signal)) publish({ catalogue: catalogue.ships, status: 'ready' })
      }).catch(fail)
    }

    load(true)
    const unsubscribe = needsFleet
      ? events.subscribe('activity-entry', () => load())
      : needsActions
        ? events.subscribe('command-catalogue', () => load())
        : undefined
    return () => {
      latest.cancel()
      unsubscribe?.()
    }
  }, [api, cacheKey, events, view])

  return snapshot
}
