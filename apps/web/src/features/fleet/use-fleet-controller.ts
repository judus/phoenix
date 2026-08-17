import { useEffect, useState } from 'react'
import type { FleetResponse, GameActionCatalogResponse, ShipDefinition } from '@phoenix/contracts'
import type { PhoenixApi } from '../../application/api/phoenix-api.js'
import type { PhoenixEventHub } from '../../application/events/phoenix-event-hub.js'

export type FleetView = 'overview' | 'current-overview' | 'current-loadout' | 'current-cargo' | 'current-engineering' | 'carriers' | 'stored-modules' | 'catalogue'

export interface FleetControllerSnapshot {
  actions?: GameActionCatalogResponse
  catalogue?: readonly ShipDefinition[]
  error?: string
  fleet?: FleetResponse
  status: 'idle' | 'loading' | 'ready' | 'error'
}

export function useFleetController(api: PhoenixApi, events: PhoenixEventHub, view: FleetView): FleetControllerSnapshot {
  const [snapshot, setSnapshot] = useState<FleetControllerSnapshot>({ status: 'idle' })

  useEffect(() => {
    const needsFleet = view === 'overview' || view === 'carriers' || view === 'stored-modules'
    const needsCatalogue = view === 'catalogue'
    const needsActions = view === 'current-overview'
    if (!needsFleet && !needsCatalogue && !needsActions) {
      setSnapshot({ status: 'idle' })
      return
    }

    const abort = new AbortController()
    let revision = 0
    const load = () => {
      const requestRevision = ++revision
      setSnapshot(current => ({ ...current, error: undefined, status: 'loading' }))
      const fail = (cause: unknown) => {
        if (abort.signal.aborted || requestRevision !== revision) return
        setSnapshot({
          error: cause instanceof Error ? cause.message : 'Fleet data unavailable.',
          status: 'error'
        })
      }
      if (needsFleet) {
        void api.getFleet(abort.signal).then(fleet => {
          if (!abort.signal.aborted && requestRevision === revision) setSnapshot({ fleet, status: 'ready' })
        }).catch(fail)
        return
      }
      if (needsActions) {
        void api.getActions(abort.signal).then(actions => {
          if (!abort.signal.aborted && requestRevision === revision) setSnapshot({ actions, status: 'ready' })
        }).catch(fail)
        return
      }
      void api.getShipCatalogue(abort.signal).then(catalogue => {
        if (!abort.signal.aborted && requestRevision === revision) setSnapshot({ catalogue: catalogue.ships, status: 'ready' })
      }).catch(fail)
    }

    load()
    const unsubscribe = needsFleet
      ? events.subscribe('activity-entry', load)
      : needsActions
        ? events.subscribe('command-catalogue', load)
        : undefined
    return () => {
      abort.abort()
      unsubscribe?.()
    }
  }, [api, events, view])

  return snapshot
}
