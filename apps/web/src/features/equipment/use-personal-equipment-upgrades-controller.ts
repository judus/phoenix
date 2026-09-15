import { useEffect, useState } from 'react'
import type { PersonalEquipmentUpgradesResponse } from '@phoenix/contracts'
import type { PhoenixApi } from '../../application/api/phoenix-api.js'
import { readControllerSnapshot, storeControllerSnapshot } from '../../application/cache/controller-snapshot-cache.js'
import { LatestRequest } from '../../application/requests/latest-request.js'

const CACHE_KEY = 'equipment:upgrades'

export interface PersonalEquipmentUpgradesControllerSnapshot {
  error?: string
  upgrades?: PersonalEquipmentUpgradesResponse
  status: 'idle' | 'loading' | 'ready' | 'error'
}

export function usePersonalEquipmentUpgradesController(
  api: PhoenixApi,
  active: boolean
): PersonalEquipmentUpgradesControllerSnapshot {
  const [snapshot, setSnapshot] = useState<PersonalEquipmentUpgradesControllerSnapshot>(() => (
    readControllerSnapshot(api, CACHE_KEY) ?? { status: 'idle' }
  ))

  useEffect(() => {
    if (!active) return
    const latest = new LatestRequest()
    const retained = readControllerSnapshot<PersonalEquipmentUpgradesControllerSnapshot>(api, CACHE_KEY)
    const signal = latest.start()
    setSnapshot(retained ?? { status: 'loading' })
    void api.getPersonalEquipmentUpgrades(signal).then(upgrades => {
      if (latest.isCurrent(signal)) {
        setSnapshot(storeControllerSnapshot(api, CACHE_KEY, { status: 'ready', upgrades }))
      }
    }).catch((cause: unknown) => {
      if (!latest.isCurrent(signal)) return
      const error = cause instanceof Error ? cause.message : 'Personal equipment upgrades unavailable.'
      setSnapshot({ error, status: 'error' })
    })
    return () => latest.cancel()
  }, [active, api])

  return snapshot
}
