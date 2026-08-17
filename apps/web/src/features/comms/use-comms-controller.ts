import { useEffect, useState } from 'react'
import type { CommunicationsResponse, GalnetNewsResponse, GameActionCatalogResponse } from '@phoenix/contracts'
import type { PhoenixApi } from '../../application/api/phoenix-api.js'
import { readControllerSnapshot, storeControllerSnapshot } from '../../application/cache/controller-snapshot-cache.js'
import type { PhoenixEventHub } from '../../application/events/phoenix-event-hub.js'
import { LatestRequest } from '../../application/requests/latest-request.js'

export type CommsView = 'overview' | 'inbox' | 'traffic' | 'contacts' | 'galnet' | 'radio'

export interface CommsControllerSnapshot {
  actions?: GameActionCatalogResponse
  communications?: CommunicationsResponse
  error?: string
  galnet?: GalnetNewsResponse
  status: 'idle' | 'loading' | 'ready' | 'error'
}

export function useCommsController(api: PhoenixApi, events: PhoenixEventHub, view: CommsView): CommsControllerSnapshot {
  const cacheKey = `comms:${view}`
  const [snapshot, setSnapshot] = useState<CommsControllerSnapshot>(() =>
    readControllerSnapshot(api, cacheKey) ?? { status: 'idle' }
  )

  useEffect(() => {
    const latest = new LatestRequest()
    const retained = readControllerSnapshot<CommsControllerSnapshot>(api, cacheKey)
    const publish = (next: CommsControllerSnapshot) => setSnapshot(storeControllerSnapshot(api, cacheKey, next))
    const load = (showLoading = false) => {
      const signal = latest.start()
      if (showLoading) setSnapshot(retained ?? { status: 'loading' })
      const request = view === 'galnet'
        ? api.getGalnetNews(40, signal).then(galnet => ({ galnet }))
        : view === 'radio'
          ? api.getActions(signal).then(actions => ({ actions }))
          : api.getCommunications(view === 'inbox' || view === 'traffic' ? view : 'all', 500, signal)
            .then(communications => ({ communications }))
      void request.then(result => {
        if (latest.isCurrent(signal)) publish({ ...result, status: 'ready' })
      }).catch(cause => {
        if (!latest.isCurrent(signal)) return
        const error = cause instanceof Error ? cause.message : 'Communications unavailable.'
        setSnapshot(current => current.status === 'ready' ? { ...current, error } : { error, status: 'error' })
      })
    }

    load(true)
    const unsubscribe = view === 'overview' || view === 'inbox' || view === 'traffic' || view === 'contacts'
      ? events.subscribe('activity-entry', entry => {
          if (entry.source === 'journal' && (entry.event === 'ReceiveText' || entry.event === 'SendText')) load()
        })
      : () => undefined
    return () => {
      latest.cancel()
      unsubscribe()
    }
  }, [api, cacheKey, events, view])

  return snapshot
}
