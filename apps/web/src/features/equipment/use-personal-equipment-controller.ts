import { useEffect, useState } from 'react'
import type { CommanderEquipmentResponse } from '@phoenix/contracts'
import type { PhoenixApi } from '../../application/api/phoenix-api.js'
import { readControllerSnapshot, storeControllerSnapshot } from '../../application/cache/controller-snapshot-cache.js'
import type { PhoenixEventHub } from '../../application/events/phoenix-event-hub.js'
import { LatestRequest } from '../../application/requests/latest-request.js'

const CACHE_KEY = 'commander:equipment'

export interface PersonalEquipmentControllerSnapshot {
  equipment?: CommanderEquipmentResponse
  error?: string
  status: 'idle' | 'loading' | 'ready' | 'error'
}

export function usePersonalEquipmentController(
  api: PhoenixApi,
  events: PhoenixEventHub,
  active: boolean
): PersonalEquipmentControllerSnapshot {
  const [snapshot, setSnapshot] = useState<PersonalEquipmentControllerSnapshot>(() => (
    readControllerSnapshot(api, CACHE_KEY) ?? { status: 'idle' }
  ))

  useEffect(() => {
    if (!active) return
    const latest = new LatestRequest()
    const retained = readControllerSnapshot<PersonalEquipmentControllerSnapshot>(api, CACHE_KEY)
    const publish = (next: PersonalEquipmentControllerSnapshot) => {
      setSnapshot(storeControllerSnapshot(api, CACHE_KEY, next))
    }
    const load = (showLoading = false) => {
      const signal = latest.start()
      if (showLoading) setSnapshot(retained ?? { status: 'loading' })
      void api.getCommanderEquipment(signal).then(equipment => {
        if (latest.isCurrent(signal)) publish({ equipment, status: 'ready' })
      }).catch((cause: unknown) => {
        if (!latest.isCurrent(signal)) return
        const error = cause instanceof Error ? cause.message : 'Commander equipment unavailable.'
        setSnapshot(current => current.status === 'ready' ? { ...current, error } : { error, status: 'error' })
      })
    }

    load(true)
    const unsubscribe = events.subscribe('activity-entry', () => load())
    return () => {
      latest.cancel()
      unsubscribe()
    }
  }, [active, api, events])

  return snapshot
}
