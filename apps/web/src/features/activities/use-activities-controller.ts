import { useEffect, useState } from 'react'
import type { MissionsResponse } from '@phoenix/contracts'
import type { PhoenixApi } from '../../application/api/phoenix-api.js'
import { readControllerSnapshot, storeControllerSnapshot } from '../../application/cache/controller-snapshot-cache.js'
import type { PhoenixEventHub } from '../../application/events/phoenix-event-hub.js'
import { LatestRequest } from '../../application/requests/latest-request.js'

export type ActivitiesView = 'missions' | 'objectives' | 'community-goals' | 'powerplay' | 'colonisation'

export interface ActivitiesControllerSnapshot {
  error?: string
  missions?: MissionsResponse
  status: 'idle' | 'loading' | 'ready' | 'error'
}

const missionEvents = new Set([
  'CargoDepot',
  'MissionAbandoned',
  'MissionAccepted',
  'MissionCompleted',
  'MissionFailed',
  'MissionRedirected',
  'Missions'
])

export function useActivitiesController(
  api: PhoenixApi,
  events: PhoenixEventHub,
  view: ActivitiesView
): ActivitiesControllerSnapshot {
  const cacheKey = `activities:${view}`
  const [snapshot, setSnapshot] = useState<ActivitiesControllerSnapshot>(() =>
    readControllerSnapshot(api, cacheKey) ?? { status: 'idle' }
  )

  useEffect(() => {
    if (view !== 'missions') {
      setSnapshot({ status: 'ready' })
      return
    }

    const request = new LatestRequest()
    const retained = readControllerSnapshot<ActivitiesControllerSnapshot>(api, cacheKey)
    const publish = (next: ActivitiesControllerSnapshot) => setSnapshot(storeControllerSnapshot(api, cacheKey, next))
    const load = (showLoading = false) => {
      const signal = request.start()
      if (showLoading) setSnapshot(retained ?? { status: 'loading' })
      void api.getMissions(signal).then(missions => {
        if (request.isCurrent(signal)) publish({ missions, status: 'ready' })
      }).catch(cause => {
        if (!request.isCurrent(signal)) return
        const error = cause instanceof Error ? cause.message : 'Mission records unavailable.'
        setSnapshot(current => current.status === 'ready' ? { ...current, error } : { error, status: 'error' })
      })
    }

    load(true)
    const unsubscribe = events.subscribe('activity-entry', entry => {
      if (entry.source === 'journal' && missionEvents.has(entry.event)) load()
    })
    return () => {
      request.cancel()
      unsubscribe()
    }
  }, [api, cacheKey, events, view])

  return snapshot
}
