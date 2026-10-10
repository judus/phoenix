import { useEffect, useState } from 'react'
import type { ColonisationResponse } from '@phoenix/contracts'
import type { CommunityGoalsResponse, MissionsResponse } from '@phoenix/contracts'
import type { PhoenixApi } from '../../application/api/phoenix-api.js'
import { readControllerSnapshot, storeControllerSnapshot } from '../../application/cache/controller-snapshot-cache.js'
import type { PhoenixEventHub } from '../../application/events/phoenix-event-hub.js'
import { LatestRequest } from '../../application/requests/latest-request.js'

export type ActivitiesView = 'missions' | 'objectives' | 'community-goals' | 'powerplay' | 'colonisation'

export interface ActivitiesControllerSnapshot {
  colonisation?: ColonisationResponse
  error?: string
  missions?: MissionsResponse
  communityGoals?: CommunityGoalsResponse
  status: 'idle' | 'loading' | 'ready' | 'error'
}

const missionEvents = new Set([
  'CargoDepot',
  'MissionAbandoned',
  'MissionAccepted',
  'MissionCompleted',
  'MissionFailed',
  'MissionRedirected',
  'Missions',
  'inventory.backpack_changed',
  'inventory.ship_locker_changed'
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
    if (view !== 'missions' && view !== 'community-goals' && view !== 'colonisation') {
      setSnapshot({ status: 'ready' })
      return
    }

    const request = new LatestRequest()
    let refreshTimer: ReturnType<typeof setTimeout> | undefined
    const retained = readControllerSnapshot<ActivitiesControllerSnapshot>(api, cacheKey)
    const publish = (next: ActivitiesControllerSnapshot) => setSnapshot(storeControllerSnapshot(api, cacheKey, next))
    const load = (showLoading = false) => {
      const signal = request.start()
      if (showLoading) setSnapshot(retained ?? { status: 'loading' })
      const result = view === 'community-goals'
        ? api.getCommunityGoals(signal).then(communityGoals => ({ communityGoals }))
        : view === 'colonisation' ? api.getColonisation(signal).then(colonisation => ({ colonisation }))
          : api.getMissions(signal).then(missions => ({ missions }))
      void result.then(data => {
        if (request.isCurrent(signal)) publish({ ...data, status: 'ready' })
      }).catch(cause => {
        if (!request.isCurrent(signal)) return
        const error = cause instanceof Error ? cause.message : view === 'community-goals' ? 'Community Goals unavailable.'
          : view === 'colonisation' ? 'Construction records unavailable.' : 'Mission records unavailable.'
        setSnapshot(current => current.status === 'ready' ? { ...current, error } : { error, status: 'error' })
      }).finally(() => {
        if (view === 'community-goals' && request.isCurrent(signal)) {
          // Start after completion, beyond the server cache's inclusive 15-minute TTL.
          refreshTimer = setTimeout(() => load(), 15 * 60 * 1000 + 1000)
        }
      })
    }

    load(true)
    const unsubscribe = view === 'missions' ? events.subscribe('activity-entry', entry => {
      if (missionEvents.has(entry.event)) load()
    }) : view === 'colonisation' ? events.subscribe('activity-entry', entry => {
      if (entry.event.startsWith('Colonisation')) load()
    }) : () => undefined
    const unsubscribeHistory = view === 'colonisation' ? events.subscribe('journal-history-loaded', () => load()) : () => undefined
    return () => {
      request.cancel()
      unsubscribe()
      unsubscribeHistory()
      if (refreshTimer !== undefined) clearTimeout(refreshTimer)
    }
  }, [api, cacheKey, events, view])

  return snapshot
}
