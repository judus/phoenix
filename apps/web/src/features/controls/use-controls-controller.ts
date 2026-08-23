import { useEffect, useState } from 'react'
import type { GameActionCatalogResponse, PhoenixControlDeckConfiguration } from '@phoenix/contracts'
import type { ControlDeckCommandCatalogue } from 'control-deck/core'
import type { PhoenixApi } from '../../application/api/phoenix-api.js'
import type { PhoenixEventHub } from '../../application/events/phoenix-event-hub.js'
import { LatestRequest } from '../../application/requests/latest-request.js'

export interface ControlsControllerSnapshot {
  actions?: GameActionCatalogResponse
  commands?: ControlDeckCommandCatalogue
  error?: string
  configuration?: PhoenixControlDeckConfiguration
  status: 'loading' | 'ready' | 'error'
}

export function useControlsController(api: PhoenixApi, events: PhoenixEventHub): ControlsControllerSnapshot {
  const [snapshot, setSnapshot] = useState<ControlsControllerSnapshot>({ status: 'loading' })

  useEffect(() => {
    const latest = new LatestRequest()
    const load = () => {
      const signal = latest.start()
      void Promise.all([api.getActions(signal), api.getControlDeckCommands(signal), api.getControlDeckConfiguration(signal)])
        .then(([actions, commands, configuration]) => {
          if (latest.isCurrent(signal)) setSnapshot({ actions, commands, configuration, status: 'ready' })
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
