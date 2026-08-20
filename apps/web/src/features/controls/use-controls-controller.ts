import { useEffect, useState } from 'react'
import type { ControlGridLayout, GameActionCatalogResponse } from '@phoenix/contracts'
import type { PhoenixApi } from '../../application/api/phoenix-api.js'
import type { PhoenixEventHub } from '../../application/events/phoenix-event-hub.js'
import { LatestRequest } from '../../application/requests/latest-request.js'

export interface ControlsControllerSnapshot {
  actions?: GameActionCatalogResponse
  error?: string
  layout?: ControlGridLayout
  status: 'loading' | 'ready' | 'error'
}

export function useControlsController(api: PhoenixApi, events: PhoenixEventHub): ControlsControllerSnapshot {
  const [snapshot, setSnapshot] = useState<ControlsControllerSnapshot>({ status: 'loading' })

  useEffect(() => {
    const latest = new LatestRequest()
    const load = () => {
      const signal = latest.start()
      void Promise.all([api.getActions(signal), api.getControlLayout(signal)])
        .then(([actions, layout]) => {
          if (latest.isCurrent(signal)) setSnapshot({ actions, layout, status: 'ready' })
        })
        .catch(cause => {
          if (latest.isCurrent(signal)) setSnapshot({
            error: cause instanceof Error ? cause.message : 'Controls unavailable.',
            status: 'error'
          })
        })
    }
    load()
    const unsubscribe = events.subscribe('command-catalogue', load)
    return () => { latest.cancel(); unsubscribe() }
  }, [api, events])

  return snapshot
}
