import { useCallback, useEffect, useState } from 'react'
import type { PowerplayResponse, PowerplayTarget } from '@phoenix/contracts'
import type { PhoenixApi } from '../../application/api/phoenix-api.js'
import type { PhoenixEventHub } from '../../application/events/phoenix-event-hub.js'
import { LatestRequest } from '../../application/requests/latest-request.js'
import { readControllerSnapshot, storeControllerSnapshot } from '../../application/cache/controller-snapshot-cache.js'

interface Snapshot {
  data?: PowerplayResponse
  error?: string
  status: 'loading' | 'ready' | 'error'
}

export function usePowerplayController(api: PhoenixApi, events: PhoenixEventHub) {
  const key = 'activities:powerplay'
  const [snapshot, setSnapshot] = useState<Snapshot>(() => readControllerSnapshot(api, key) ?? { status: 'loading' })
  const [requests] = useState(() => ({ read: new LatestRequest(), write: new LatestRequest() }))
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const load = () => {
      const signal = requests.read.start()
      void api.getPowerplay(signal).then(data => {
        if (requests.read.isCurrent(signal)) setSnapshot(storeControllerSnapshot(api, key, { status: 'ready', data }))
      }).catch(cause => {
        if (requests.read.isCurrent(signal)) setSnapshot(current => ({ ...current,
          status: current.data ? 'ready' : 'error', error: cause instanceof Error ? cause.message : 'Powerplay records unavailable.' }))
      })
    }
    load()
    const unsubscribe = events.subscribe('activity-entry', entry => { if (entry.event.startsWith('Powerplay')) load() })
    const unsubscribeHistory = events.subscribe('journal-history-loaded', load)
    return () => { requests.read.cancel(); requests.write.cancel(); unsubscribe(); unsubscribeHistory() }
  }, [api, events, requests])

  const saveTarget = useCallback(async (target: PowerplayTarget | null) => {
    const signal = requests.write.start()
    setSaving(true)
    try {
      const data = await api.savePowerplayTarget(target, signal)
      if (requests.write.isCurrent(signal)) {
        requests.read.cancel()
        setSnapshot(storeControllerSnapshot(api, key, { status: 'ready', data }))
      }
    } finally { if (requests.write.isCurrent(signal)) setSaving(false) }
  }, [api, requests])

  return { ...snapshot, saving, saveTarget }
}

export type PowerplayController = ReturnType<typeof usePowerplayController>
