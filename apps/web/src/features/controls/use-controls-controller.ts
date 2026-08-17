import { useEffect, useState } from 'react'
import type { ControlGridLayout, GameActionCatalogResponse } from '@phoenix/contracts'
import type { PhoenixApi } from '../../application/api/phoenix-api.js'
import type { PhoenixEventHub } from '../../application/events/phoenix-event-hub.js'

export interface ControlsControllerSnapshot {
  actions?: GameActionCatalogResponse
  error?: string
  layout?: ControlGridLayout
  status: 'loading' | 'ready' | 'error'
}

export function useControlsController(api: PhoenixApi, events: PhoenixEventHub): ControlsControllerSnapshot {
  const [snapshot, setSnapshot] = useState<ControlsControllerSnapshot>({ status: 'loading' })

  useEffect(() => {
    const abort = new AbortController()
    let revision = 0
    const load = () => {
      const requestRevision = ++revision
      void Promise.all([api.getActions(abort.signal), api.getControlLayout(abort.signal)])
        .then(([actions, layout]) => {
          if (!abort.signal.aborted && requestRevision === revision) setSnapshot({ actions, layout, status: 'ready' })
        })
        .catch(cause => {
          if (!abort.signal.aborted && requestRevision === revision) setSnapshot({
            error: cause instanceof Error ? cause.message : 'Controls unavailable.',
            status: 'error'
          })
        })
    }
    load()
    const unsubscribe = events.subscribe('command-catalogue', load)
    return () => { abort.abort(); unsubscribe() }
  }, [api, events])

  return snapshot
}
