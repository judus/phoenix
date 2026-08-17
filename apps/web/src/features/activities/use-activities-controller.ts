import { useEffect, useState } from 'react'
import type { MissionsResponse } from '@phoenix/contracts'
import type { PhoenixApi } from '../../application/api/phoenix-api.js'
import { readControllerSnapshot, storeControllerSnapshot } from '../../application/cache/controller-snapshot-cache.js'
import type { PhoenixEventHub } from '../../application/events/phoenix-event-hub.js'
import { activitiesFixture } from './activities-fixture.js'

export type ActivitiesView = 'missions' | 'objectives' | 'community-goals' | 'powerplay' | 'colonisation'

export interface ActivitiesControllerSnapshot {
  error?: string
  fixture?: boolean
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
  view: ActivitiesView,
  fixture?: 'review'
): ActivitiesControllerSnapshot {
  const cacheKey = `activities:${view}:${fixture ?? ''}`
  const [snapshot, setSnapshot] = useState<ActivitiesControllerSnapshot>(() =>
    readControllerSnapshot(api, cacheKey) ?? { status: 'idle' }
  )

  useEffect(() => {
    if (fixture === 'review' && import.meta.env.DEV) {
      setSnapshot({ fixture: true, ...(view === 'missions' ? { missions: activitiesFixture() } : {}), status: 'ready' })
      return
    }
    if (view !== 'missions') {
      setSnapshot({ ...(import.meta.env.DEV ? { fixture: true } : {}), status: 'ready' })
      return
    }

    const abort = new AbortController()
    let revision = 0
    const retained = readControllerSnapshot<ActivitiesControllerSnapshot>(api, cacheKey)
    const publish = (next: ActivitiesControllerSnapshot) => setSnapshot(storeControllerSnapshot(api, cacheKey, next))
    const load = (showLoading = false) => {
      const requestRevision = ++revision
      if (showLoading) setSnapshot(retained ?? { status: 'loading' })
      void api.getMissions(abort.signal).then(missions => {
        if (!abort.signal.aborted && requestRevision === revision) publish({ missions, status: 'ready' })
      }).catch(cause => {
        if (abort.signal.aborted || requestRevision !== revision) return
        const error = cause instanceof Error ? cause.message : 'Mission records unavailable.'
        setSnapshot(current => current.status === 'ready' ? { ...current, error } : { error, status: 'error' })
      })
    }

    load(true)
    const unsubscribe = events.subscribe('activity-entry', entry => {
      if (entry.source === 'journal' && missionEvents.has(entry.event)) load()
    })
    return () => {
      abort.abort()
      unsubscribe()
    }
  }, [api, cacheKey, events, fixture, view])

  return snapshot
}
