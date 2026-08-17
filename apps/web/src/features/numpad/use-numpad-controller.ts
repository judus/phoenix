import { useEffect, useState } from 'react'
import type { CommandDescriptor, NumpadTreeSnapshot, PhoenixModules } from '@phoenix/contracts'
import type { PhoenixApi } from '../../application/api/phoenix-api.js'
import type { PhoenixEventHub } from '../../application/events/phoenix-event-hub.js'

export interface NumpadControllerSnapshot { commands: CommandDescriptor[], error?: string, settings?: PhoenixModules, snapshot?: NumpadTreeSnapshot, status: 'loading' | 'ready' | 'error' }

export function useNumpadController(api: PhoenixApi, events: PhoenixEventHub): NumpadControllerSnapshot {
  const [state, setState] = useState<NumpadControllerSnapshot>({ commands: [], status: 'loading' })
  useEffect(() => {
    const abort = new AbortController()
    let revision = 0
    const load = () => {
      const request = ++revision
      void Promise.all([api.getNumpadSnapshot(abort.signal), api.getModuleSettings(abort.signal), api.getCommands(abort.signal)])
        .then(([snapshot, settings, commands]) => { if (!abort.signal.aborted && request === revision) setState({ commands: commands.commands, settings, snapshot, status: 'ready' }) })
        .catch(cause => { if (!abort.signal.aborted && request === revision) setState({ commands: [], error: cause instanceof Error ? cause.message : 'Numpad unavailable.', status: 'error' }) })
    }
    load()
    const unsubscribe = events.subscribe('command-catalogue', load)
    return () => { abort.abort(); unsubscribe() }
  }, [api, events])
  return state
}
