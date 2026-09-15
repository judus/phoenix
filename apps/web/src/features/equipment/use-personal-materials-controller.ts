import { useEffect, useState } from 'react'
import type { PersonalMaterialInventoryResponse } from '@phoenix/contracts'
import type { PhoenixApi } from '../../application/api/phoenix-api.js'
import { readControllerSnapshot, storeControllerSnapshot } from '../../application/cache/controller-snapshot-cache.js'
import type { PhoenixEventHub } from '../../application/events/phoenix-event-hub.js'
import { LatestRequest } from '../../application/requests/latest-request.js'

const CACHE_KEY = 'equipment:materials'

export interface PersonalMaterialsControllerSnapshot {
  error?: string
  inventory?: PersonalMaterialInventoryResponse
  status: 'idle' | 'loading' | 'ready' | 'error'
}

export function usePersonalMaterialsController(
  api: PhoenixApi,
  events: PhoenixEventHub,
  active: boolean
): PersonalMaterialsControllerSnapshot {
  const [snapshot, setSnapshot] = useState<PersonalMaterialsControllerSnapshot>(() => (
    readControllerSnapshot(api, CACHE_KEY) ?? { status: 'idle' }
  ))

  useEffect(() => {
    if (!active) return
    const latest = new LatestRequest()
    const retained = readControllerSnapshot<PersonalMaterialsControllerSnapshot>(api, CACHE_KEY)
    const publish = (next: PersonalMaterialsControllerSnapshot) => {
      setSnapshot(storeControllerSnapshot(api, CACHE_KEY, next))
    }
    const load = (showLoading = false) => {
      const signal = latest.start()
      if (showLoading) setSnapshot(retained ?? { status: 'loading' })
      void api.getPersonalMaterialInventory(signal).then(inventory => {
        if (latest.isCurrent(signal)) publish({ inventory, status: 'ready' })
      }).catch((cause: unknown) => {
        if (!latest.isCurrent(signal)) return
        const error = cause instanceof Error ? cause.message : 'Personal materials unavailable.'
        setSnapshot(current => current.status === 'ready' ? { ...current, error } : { error, status: 'error' })
      })
    }

    load(true)
    const unsubscribe = events.subscribe('runtime-state', () => load())
    return () => {
      latest.cancel()
      unsubscribe()
    }
  }, [active, api, events])

  return snapshot
}
