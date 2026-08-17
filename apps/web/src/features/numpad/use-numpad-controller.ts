import { useEffect, useState } from 'react'
import type { CommandDescriptor, NumpadTreeSnapshot, PhoenixModules } from '@phoenix/contracts'
import type { PhoenixApi } from '../../application/api/phoenix-api.js'
import type { PhoenixEventHub } from '../../application/events/phoenix-event-hub.js'
import { LatestRequest } from '../../application/requests/latest-request.js'

export interface NumpadControllerSnapshot { commands: CommandDescriptor[], error?: string, settings?: PhoenixModules, snapshot?: NumpadTreeSnapshot, status: 'loading' | 'ready' | 'error' }

export function useNumpadController(api: PhoenixApi, events: PhoenixEventHub): NumpadControllerSnapshot {
  const [state, setState] = useState<NumpadControllerSnapshot>({ commands: [], status: 'loading' })
  useEffect(() => {
    const latest = new LatestRequest()
    const load = () => {
      const signal = latest.start()
      void Promise.all([api.getNumpadSnapshot(signal), api.getModuleSettings(signal), api.getCommands(signal)])
        .then(([snapshot, settings, commands]) => { if (latest.isCurrent(signal)) setState({ commands: commands.commands, settings, snapshot, status: 'ready' }) })
        .catch(cause => { if (latest.isCurrent(signal)) setState({ commands: [], error: cause instanceof Error ? cause.message : 'Numpad unavailable.', status: 'error' }) })
    }
    load()
    const unsubscribe = events.subscribe('command-catalogue', load)
    return () => { latest.cancel(); unsubscribe() }
  }, [api, events])
  return state
}
