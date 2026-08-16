import { useEffect, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type {
  ActivityLogEntry,
  GameActionCatalogResponse,
  NavigationRoute
} from '@phoenix/contracts'
import type { PhoenixApi } from '../../application/api/phoenix-api.js'
import type { PhoenixEventHub } from '../../application/events/phoenix-event-hub.js'

export interface DashboardControllerSnapshot {
  actions?: GameActionCatalogResponse
  activity: readonly ActivityLogEntry[]
  error?: string
  route?: NavigationRoute
  status: 'loading' | 'ready' | 'error'
}

const INITIAL_SNAPSHOT: DashboardControllerSnapshot = {
  activity: [],
  status: 'loading'
}

export function useDashboardController(
  api: PhoenixApi,
  events: PhoenixEventHub
): DashboardControllerSnapshot {
  const [snapshot, setSnapshot] = useState<DashboardControllerSnapshot>(INITIAL_SNAPSHOT)

  useEffect(() => {
    const abort = new AbortController()
    let activityRevision = 0
    let routeRevision = 0
    let actionsRevision = 0

    const unsubscribeActivity = events.subscribe('activity-entry', entry => {
      activityRevision += 1
      setSnapshot(current => ({
        ...current,
        activity: mergeActivityEntry(current.activity, entry),
        status: 'ready'
      }))
    })
    const unsubscribeRoute = events.subscribe('navigation-route', route => {
      routeRevision += 1
      setSnapshot(current => ({ ...current, route, status: 'ready' }))
    })
    const unsubscribeCatalogue = events.subscribe('command-catalogue', () => {
      const revision = ++actionsRevision
      void api.getActions(abort.signal)
        .then(actions => {
          if (abort.signal.aborted || revision !== actionsRevision) return
          setSnapshot(current => ({ ...current, actions, status: 'ready' }))
        })
        .catch(cause => {
          if (!abort.signal.aborted) setError(setSnapshot, cause)
        })
    })

    const activityAtRequest = activityRevision
    const routeAtRequest = routeRevision
    const actionsAtRequest = ++actionsRevision
    void Promise.allSettled([
      api.getActivityLog(24, abort.signal).then(log => {
        if (activityAtRequest === activityRevision) {
          setSnapshot(current => ({ ...current, activity: log.entries }))
        }
      }),
      api.getNavigationRoute(abort.signal).then(route => {
        if (routeAtRequest === routeRevision) setSnapshot(current => ({ ...current, route }))
      }),
      api.getActions(abort.signal).then(actions => {
        if (actionsAtRequest === actionsRevision) setSnapshot(current => ({ ...current, actions }))
      })
    ]).then(results => {
      if (abort.signal.aborted) return
      const failures = results.filter(result => result.status === 'rejected')
      setSnapshot(current => ({
        ...current,
        ...(failures.length === 0 ? {} : { error: errorMessage(failures[0]?.reason) }),
        status: failures.length === results.length ? 'error' : 'ready'
      }))
    })

    return () => {
      abort.abort()
      unsubscribeActivity()
      unsubscribeRoute()
      unsubscribeCatalogue()
    }
  }, [api, events])

  return snapshot
}

export function mergeActivityEntry(
  entries: readonly ActivityLogEntry[],
  entry: ActivityLogEntry,
  limit = 24
): readonly ActivityLogEntry[] {
  return [entry, ...entries.filter(candidate => candidate.id !== entry.id)].slice(0, limit)
}

function setError(
  setSnapshot: Dispatch<SetStateAction<DashboardControllerSnapshot>>,
  cause: unknown
): void {
  setSnapshot(current => ({ ...current, error: errorMessage(cause) }))
}

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : 'Dashboard data unavailable.'
}
