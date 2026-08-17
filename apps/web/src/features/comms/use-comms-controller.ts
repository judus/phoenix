import { useEffect, useState } from 'react'
import type { CommunicationsResponse, GalnetNewsResponse, GameActionCatalogResponse } from '@phoenix/contracts'
import type { PhoenixApi } from '../../application/api/phoenix-api.js'
import type { PhoenixEventHub } from '../../application/events/phoenix-event-hub.js'

export type CommsView = 'overview' | 'inbox' | 'traffic' | 'contacts' | 'galnet' | 'radio'

export interface CommsControllerSnapshot {
  actions?: GameActionCatalogResponse
  communications?: CommunicationsResponse
  error?: string
  galnet?: GalnetNewsResponse
  status: 'idle' | 'loading' | 'ready' | 'error'
}

export function useCommsController(api: PhoenixApi, events: PhoenixEventHub, view: CommsView): CommsControllerSnapshot {
  const [snapshot, setSnapshot] = useState<CommsControllerSnapshot>({ status: 'idle' })

  useEffect(() => {
    const abort = new AbortController()
    let revision = 0
    const load = () => {
      const requestRevision = ++revision
      setSnapshot(current => ({ ...current, error: undefined, status: 'loading' }))
      const request = view === 'galnet'
        ? api.getGalnetNews(40, abort.signal).then(galnet => ({ galnet }))
        : view === 'radio'
          ? api.getActions(abort.signal).then(actions => ({ actions }))
          : api.getCommunications(view === 'inbox' || view === 'traffic' ? view : 'all', 500, abort.signal)
            .then(communications => ({ communications }))
      void request.then(result => {
        if (!abort.signal.aborted && requestRevision === revision) setSnapshot({ ...result, status: 'ready' })
      }).catch(cause => {
        if (abort.signal.aborted || requestRevision !== revision) return
        setSnapshot({ error: cause instanceof Error ? cause.message : 'Communications unavailable.', status: 'error' })
      })
    }

    load()
    const unsubscribe = view === 'overview' || view === 'inbox' || view === 'traffic' || view === 'contacts'
      ? events.subscribe('activity-entry', entry => {
          if (entry.source === 'journal' && (entry.event === 'ReceiveText' || entry.event === 'SendText')) load()
        })
      : () => undefined
    return () => {
      abort.abort()
      unsubscribe()
    }
  }, [api, events, view])

  return snapshot
}
