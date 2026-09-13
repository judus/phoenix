import { useEffect, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type {
  CommanderLogEntry,
  EngineeringMaterialWatchlistResponse,
  GameActionCatalogResponse,
  LocalTrafficResponse,
  NavigationRoute
} from '@phoenix/contracts'
import type { PhoenixApi } from '../../application/api/phoenix-api.js'
import type { PhoenixEventHub } from '../../application/events/phoenix-event-hub.js'

export interface DashboardControllerSnapshot {
  actions?: GameActionCatalogResponse
  commanderLog: readonly CommanderLogEntry[]
  error?: string
  localTraffic?: LocalTrafficResponse
  materialWatchlist?: EngineeringMaterialWatchlistResponse
  route?: NavigationRoute
  status: 'loading' | 'ready' | 'error'
}

const INITIAL_SNAPSHOT: DashboardControllerSnapshot = {
  commanderLog: [],
  status: 'loading'
}

export function useDashboardController(
  api: PhoenixApi,
  events: PhoenixEventHub
): DashboardControllerSnapshot {
  const [snapshot, setSnapshot] = useState<DashboardControllerSnapshot>(INITIAL_SNAPSHOT)

  useEffect(() => {
    const abort = new AbortController()
    let commanderLogRevision = 0
    let localTrafficRevision = 0
    let materialWatchlistRevision = 0
    let observedMaterialsAt: string | null | undefined
    let routeRevision = 0
    let actionsRevision = 0

    const unsubscribeCommanderLog = events.subscribe('commander-log-entry', entry => {
      commanderLogRevision += 1
      setSnapshot(current => ({
        ...current,
        commanderLog: mergeCommanderLogEntry(current.commanderLog, entry),
        status: 'ready'
      }))
    })
    const loadLocalTraffic = (): void => {
      const revision = ++localTrafficRevision
      void api.getLocalTraffic(5, abort.signal)
        .then(localTraffic => {
          if (abort.signal.aborted || revision !== localTrafficRevision) return
          setSnapshot(current => ({ ...current, localTraffic, status: 'ready' }))
        })
        .catch(cause => {
          if (!abort.signal.aborted && revision === localTrafficRevision) setError(setSnapshot, cause)
        })
    }
    const unsubscribeCommunications = events.subscribe('communication-message', loadLocalTraffic)
    const loadMaterialWatchlist = (): void => {
      const revision = ++materialWatchlistRevision
      void api.getEngineeringMaterialWatchlist(abort.signal)
        .then(materialWatchlist => {
          if (abort.signal.aborted || revision !== materialWatchlistRevision) return
          setSnapshot(current => ({ ...current, materialWatchlist, status: 'ready' }))
        })
        .catch(cause => {
          if (!abort.signal.aborted && revision === materialWatchlistRevision) setError(setSnapshot, cause)
        })
    }
    const unsubscribeEngineeringProjects = events.subscribe('engineering-projects-changed', loadMaterialWatchlist)
    const unsubscribeRuntime = events.subscribe('runtime-state', state => {
      const nextObservedAt = state.inventory.materials?.updatedAt ?? null
      if (observedMaterialsAt !== undefined && nextObservedAt !== observedMaterialsAt) loadMaterialWatchlist()
      observedMaterialsAt = nextObservedAt
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
          if (!abort.signal.aborted && revision === actionsRevision) setError(setSnapshot, cause)
        })
    })

    const commanderLogAtRequest = commanderLogRevision
    const localTrafficAtRequest = localTrafficRevision
    const routeAtRequest = routeRevision
    const materialWatchlistAtRequest = materialWatchlistRevision
    const actionsAtRequest = ++actionsRevision
    void Promise.allSettled([
      api.getCommanderLog(24, abort.signal).then(log => {
        if (commanderLogAtRequest === commanderLogRevision) {
          setSnapshot(current => ({ ...current, commanderLog: log.entries }))
        }
      }),
      api.getLocalTraffic(5, abort.signal).then(localTraffic => {
        if (localTrafficAtRequest === localTrafficRevision) {
          setSnapshot(current => ({ ...current, localTraffic }))
        }
      }),
      api.getEngineeringMaterialWatchlist(abort.signal).then(materialWatchlist => {
        if (materialWatchlistAtRequest === materialWatchlistRevision) {
          setSnapshot(current => ({ ...current, materialWatchlist }))
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
      const requestRevisions = [commanderLogAtRequest, localTrafficAtRequest, materialWatchlistAtRequest, routeAtRequest, actionsAtRequest]
      const currentRevisions = [commanderLogRevision, localTrafficRevision, materialWatchlistRevision, routeRevision, actionsRevision]
      const failures: unknown[] = []
      results.forEach((result, index) => {
        if (result.status === 'rejected' && requestRevisions[index] === currentRevisions[index]) {
          failures.push(result.reason)
        }
      })
      setSnapshot(current => ({
        ...current,
        ...(failures.length === 0 ? {} : { error: errorMessage(failures[0]) }),
        status: failures.length === results.length ? 'error' : 'ready'
      }))
    })

    return () => {
      abort.abort()
      unsubscribeCommanderLog()
      unsubscribeCommunications()
      unsubscribeEngineeringProjects()
      unsubscribeRuntime()
      unsubscribeRoute()
      unsubscribeCatalogue()
    }
  }, [api, events])

  return snapshot
}

export function mergeCommanderLogEntry(
  entries: readonly CommanderLogEntry[],
  entry: CommanderLogEntry,
  limit = 24
): readonly CommanderLogEntry[] {
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
