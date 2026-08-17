import { act, create } from 'react-test-renderer'
import { beforeAll, expect, test, vi } from 'vitest'
import type { ActivityLogEntry, NavigationRoute } from '@phoenix/contracts'
import type { PhoenixApi } from '../apps/web/src/application/api/phoenix-api.js'
import type {
  PhoenixEventHub,
  PhoenixEventMap,
  PhoenixEventName
} from '../apps/web/src/application/events/phoenix-event-hub.js'
import {
  useDashboardController,
  type DashboardControllerSnapshot
} from '../apps/web/src/features/dashboard/use-dashboard-controller.js'

beforeAll(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
})

test('live dashboard evidence is not overwritten by stale initial queries', async () => {
  let resolveActivity: ((value: { entries: ActivityLogEntry[], retained: number }) => void) | undefined
  let resolveRoute: ((value: NavigationRoute) => void) | undefined
  const events = new FakeEventHub()
  const api = {
    getActions: vi.fn().mockResolvedValue({ actions: [], backend: { id: 'none', available: false, simulated: true, detail: 'Unavailable' }, bindingSource: { directory: null, filePath: null, presetNames: [], available: false, bindingCount: 0, keyboardBindingCount: 0, loadedAt: null, error: null } }),
    getActivityLog: vi.fn().mockReturnValue(new Promise(resolve => { resolveActivity = resolve })),
    getNavigationRoute: vi.fn().mockReturnValue(new Promise(resolve => { resolveRoute = resolve }))
  } as unknown as PhoenixApi
  let snapshot: DashboardControllerSnapshot | undefined

  function Probe() {
    snapshot = useDashboardController(api, events)
    return null
  }

  const renderer = await act(async () => create(<Probe />))
  const liveActivity = activity('live')
  const liveRoute = route('Live destination')
  await act(async () => {
    events.emit('activity-entry', liveActivity)
    events.emit('navigation-route', liveRoute)
    resolveActivity?.({ entries: [activity('stale')], retained: 1 })
    resolveRoute?.(route('Stale destination'))
    await Promise.resolve()
  })

  expect(snapshot?.activity).toEqual([liveActivity])
  expect(snapshot?.route).toEqual(liveRoute)
  expect(snapshot?.status).toBe('ready')
  await act(async () => renderer.unmount())
})

test('an obsolete catalogue failure cannot taint a newer successful refresh', async () => {
  let rejectInitial: ((cause: Error) => void) | undefined
  const events = new FakeEventHub()
  const currentActions = { actions: [], backend: { id: 'current', available: true, simulated: false, detail: 'Ready' }, bindingSource: { directory: null, filePath: null, presetNames: [], available: false, bindingCount: 0, keyboardBindingCount: 0, loadedAt: null, error: null } }
  const api = {
    getActions: vi.fn()
      .mockReturnValueOnce(new Promise((_resolve, reject) => { rejectInitial = reject }))
      .mockResolvedValueOnce(currentActions),
    getActivityLog: vi.fn().mockResolvedValue({ entries: [], retained: 0 }),
    getNavigationRoute: vi.fn().mockResolvedValue(route('Sol'))
  } as unknown as PhoenixApi
  let snapshot: DashboardControllerSnapshot | undefined

  function Probe() { snapshot = useDashboardController(api, events); return null }
  const renderer = await act(async () => create(<Probe />))

  await act(async () => {
    events.emit('command-catalogue', { revision: 2 })
    await Promise.resolve()
    rejectInitial?.(new Error('Stale failure.'))
    await Promise.resolve()
  })

  expect(snapshot).toMatchObject({ actions: currentActions, status: 'ready' })
  expect(snapshot?.error).toBeUndefined()
  await act(async () => renderer.unmount())
})

function activity(id: string): ActivityLogEntry {
  return {
    actionable: false,
    data: {},
    event: `event.${id}`,
    id,
    importance: 'notable',
    ingestedAt: '2026-08-16T12:00:00.000Z',
    source: 'runtime',
    timestamp: '2026-08-16T12:00:00.000Z'
  }
}

function route(destination: string): NavigationRoute {
  return {
    timestamp: '2026-08-16T12:00:00.000Z',
    route: [{ system: destination, address: null, position: null, starClass: null }]
  }
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
