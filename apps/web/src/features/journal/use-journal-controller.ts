import { useEffect, useState } from 'react'
import type { ActivityLogEntry } from '@phoenix/contracts'
import type { PhoenixApi } from '../../application/api/phoenix-api.js'
import type { PhoenixEventHub } from '../../application/events/phoenix-event-hub.js'

export interface JournalControllerSnapshot {
  entries: readonly ActivityLogEntry[]
  error?: string
  retained: number
  status: 'loading' | 'ready' | 'error'
}

export function useJournalController(api: PhoenixApi, events: PhoenixEventHub): JournalControllerSnapshot {
  const [snapshot, setSnapshot] = useState<JournalControllerSnapshot>({ entries: [], retained: 0, status: 'loading' })

  useEffect(() => {
    const abort = new AbortController()
    void api.getActivityLog(500, abort.signal)
      .then(result => {
        if (abort.signal.aborted) return
        setSnapshot(current => ({
          entries: mergeEntries(current.entries, result.entries),
          retained: Math.max(current.retained, result.retained),
          status: 'ready'
        }))
      })
      .catch(cause => {
        if (!abort.signal.aborted) setSnapshot(current => current.status === 'ready'
          ? { ...current, error: message(cause) }
          : { entries: [], error: message(cause), retained: 0, status: 'error' })
      })
    const unsubscribe = events.subscribe('activity-entry', entry => {
      setSnapshot(current => ({
        ...current,
        entries: [entry, ...current.entries.filter(candidate => candidate.id !== entry.id)].slice(0, 500),
        retained: Math.max(current.retained, current.entries.length + 1),
        status: 'ready'
      }))
    })
    return () => { abort.abort(); unsubscribe() }
  }, [api, events])

  return snapshot
}

function mergeEntries(
  live: readonly ActivityLogEntry[],
  snapshot: readonly ActivityLogEntry[]
): readonly ActivityLogEntry[] {
  return [...live, ...snapshot.filter(entry => !live.some(candidate => candidate.id === entry.id))].slice(0, 500)
}

function message(cause: unknown): string {
  return cause instanceof Error ? cause.message : 'Journal unavailable.'
}
