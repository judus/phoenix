import { act, create } from 'react-test-renderer'
import { beforeAll, expect, test, vi } from 'vitest'
import type { ActivityLogEntry } from '@phoenix/contracts'
import type { PhoenixApi } from '../apps/web/src/application/api/phoenix-api.js'
import type { PhoenixEventHub, PhoenixEventMap, PhoenixEventName } from '../apps/web/src/application/events/phoenix-event-hub.js'
import { useJournalController, type JournalControllerSnapshot } from '../apps/web/src/features/journal/use-journal-controller.js'

beforeAll(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }) })

test('Journal merges live events received while its retained snapshot is loading', async () => {
  let resolveLog: ((value: { entries: ActivityLogEntry[], retained: number }) => void) | undefined
  const api = {
    getActivityLog: vi.fn().mockReturnValue(new Promise(resolve => { resolveLog = resolve }))
  } as unknown as PhoenixApi
  const events = new FakeEventHub()
  let snapshot: JournalControllerSnapshot | undefined

  function Probe() { snapshot = useJournalController(api, events); return null }
  const renderer = await act(async () => create(<Probe />))
  const live = activity('live')

  await act(async () => {
    events.emit('activity-entry', live)
    resolveLog?.({ entries: [activity('retained')], retained: 10 })
    await Promise.resolve()
  })

  expect(snapshot).toMatchObject({ retained: 10, status: 'ready' })
  expect(snapshot?.entries.map(entry => entry.id)).toEqual(['live', 'retained'])
  await act(async () => renderer.unmount())
})

test('Journal retains live events when its initial snapshot fails', async () => {
  let rejectLog: ((cause: Error) => void) | undefined
  const api = {
    getActivityLog: vi.fn().mockReturnValue(new Promise((_resolve, reject) => { rejectLog = reject }))
  } as unknown as PhoenixApi
  const events = new FakeEventHub()
  let snapshot: JournalControllerSnapshot | undefined

  function Probe() { snapshot = useJournalController(api, events); return null }
  const renderer = await act(async () => create(<Probe />))

  await act(async () => {
    events.emit('activity-entry', activity('live'))
    rejectLog?.(new Error('Snapshot unavailable.'))
    await Promise.resolve()
  })

  expect(snapshot).toMatchObject({ error: 'Snapshot unavailable.', status: 'ready' })
  expect(snapshot?.entries.map(entry => entry.id)).toEqual(['live'])
  await act(async () => renderer.unmount())
})

function activity(id: string): ActivityLogEntry {
  return { actionable: false, data: {}, event: id, id, importance: 'notable', ingestedAt: '2026-08-17T12:00:00.000Z', source: 'runtime', timestamp: '2026-08-17T12:00:00.000Z' }
}

class FakeEventHub implements PhoenixEventHub {
  readonly #listeners = new Map<PhoenixEventName, Set<(payload: unknown) => void>>()
  getConnectionSnapshot = () => ({ state: 'open' as const })
  start(): void {}
  stop(): void {}
  subscribeConnection(): () => void { return () => undefined }
  subscribe<K extends PhoenixEventName>(eventName: K, listener: (payload: PhoenixEventMap[K]) => void): () => void {
    const wrapped = (payload: unknown): void => listener(payload as PhoenixEventMap[K])
    const listeners = this.#listeners.get(eventName) ?? new Set()
    listeners.add(wrapped)
    this.#listeners.set(eventName, listeners)
    return () => listeners.delete(wrapped)
  }
  emit<K extends PhoenixEventName>(eventName: K, payload: PhoenixEventMap[K]): void {
    for (const listener of this.#listeners.get(eventName) ?? []) listener(payload)
  }
}
