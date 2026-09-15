import { useEffect, useState } from 'react'
import type { PersonalEquipmentSpecialistsResponse } from '@phoenix/contracts'
import type { PhoenixApi } from '../../application/api/phoenix-api.js'
import { readControllerSnapshot, storeControllerSnapshot } from '../../application/cache/controller-snapshot-cache.js'
import { LatestRequest } from '../../application/requests/latest-request.js'

const CACHE_KEY = 'equipment:specialists'

export interface PersonalEquipmentSpecialistsControllerSnapshot {
  error?: string
  specialists?: PersonalEquipmentSpecialistsResponse
  status: 'idle' | 'loading' | 'ready' | 'error'
}

export function usePersonalEquipmentSpecialistsController(
  api: PhoenixApi,
  active: boolean
): PersonalEquipmentSpecialistsControllerSnapshot {
  const [snapshot, setSnapshot] = useState<PersonalEquipmentSpecialistsControllerSnapshot>(() => (
    readControllerSnapshot(api, CACHE_KEY) ?? { status: 'idle' }
  ))

  useEffect(() => {
    if (!active) return
    const latest = new LatestRequest()
    const retained = readControllerSnapshot<PersonalEquipmentSpecialistsControllerSnapshot>(api, CACHE_KEY)
    const signal = latest.start()
    setSnapshot(retained ?? { status: 'loading' })
    void api.getPersonalEquipmentSpecialists(signal).then(specialists => {
      if (latest.isCurrent(signal)) {
        setSnapshot(storeControllerSnapshot(api, CACHE_KEY, { status: 'ready', specialists }))
      }
    }).catch((cause: unknown) => {
      if (!latest.isCurrent(signal)) return
      const error = cause instanceof Error ? cause.message : 'Personal equipment specialists unavailable.'
      setSnapshot({ error, status: 'error' })
    })
    return () => latest.cancel()
  }, [active, api])

  return snapshot
}
