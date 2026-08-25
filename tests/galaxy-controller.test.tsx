import { act, create } from 'react-test-renderer'
import { beforeAll, expect, test, vi } from 'vitest'
import type { ActivityLogEntry, ExplorationLedgerResponse } from '@phoenix/contracts'
import type { PhoenixApi } from '../apps/web/src/application/api/phoenix-api.js'
import type { PhoenixEventHub, PhoenixEventMap, PhoenixEventName } from '../apps/web/src/application/events/phoenix-event-hub.js'
import { useGalaxyController, type GalaxyControllerSnapshot } from '../apps/web/src/features/galaxy/use-galaxy-controller.js'

beforeAll(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }) })

test('Galaxy loads only the active view and accepts live plotted-route updates', async () => {
  const initialRoute = { timestamp: null, route: [{ system: 'Sol', address: 1, position: [0, 0, 0] as [number, number, number], starClass: 'G' }] }
  const updatedRoute = { timestamp: null, route: [{ system: 'Sirius', address: 2, position: [1, 0, 0] as [number, number, number], starClass: 'A' }] }
  const api = {
    getActions: vi.fn().mockResolvedValue({ actions: [] }),
    getNavigationRoute: vi.fn().mockResolvedValue(initialRoute),
    getSystemCartography: vi.fn()
  } as unknown as PhoenixApi
  const events = new FakeEventHub()
  let snapshot: GalaxyControllerSnapshot | undefined

  function Probe() { snapshot = useGalaxyController(api, events, 'route'); return null }
  const renderer = await act(async () => create(<Probe />))

  expect(api.getNavigationRoute).toHaveBeenCalledTimes(1)
  expect(api.getActions).toHaveBeenCalledTimes(1)
  expect(api.getSystemCartography).not.toHaveBeenCalled()
  expect(snapshot).toMatchObject({ route: initialRoute, status: 'ready' })

  await act(async () => events.emit('navigation-route', updatedRoute))
  expect(snapshot).toMatchObject({ route: updatedRoute, status: 'ready' })
  await act(async () => renderer.unmount())
})

test('a live plotted route cancels and supersedes an older route request', async () => {
  const updatedRoute = { timestamp: null, route: [{ system: 'Sirius', address: 2, position: [1, 0, 0] as [number, number, number], starClass: 'A' }] }
  let resolveRoute: ((route: typeof updatedRoute) => void) | undefined
  let requestSignal: AbortSignal | undefined
  const api = {
    getActions: vi.fn().mockResolvedValue({ actions: [] }),
    getNavigationRoute: vi.fn((_signal?: AbortSignal) => {
      requestSignal = _signal
      return new Promise<typeof updatedRoute>(resolve => { resolveRoute = resolve })
    }),
    getSystemCartography: vi.fn()
  } as unknown as PhoenixApi
  const events = new FakeEventHub()
  let snapshot: GalaxyControllerSnapshot | undefined

  function Probe() { snapshot = useGalaxyController(api, events, 'route'); return null }
  const renderer = await act(async () => create(<Probe />))

  await act(async () => events.emit('navigation-route', updatedRoute))
  expect(requestSignal?.aborted).toBe(true)
  expect(snapshot).toMatchObject({ route: updatedRoute, status: 'ready' })

  await act(async () => { resolveRoute?.({ ...updatedRoute, route: [{ ...updatedRoute.route[0]!, system: 'Stale' }] }); await Promise.resolve() })
  expect(snapshot?.route?.route[0]?.system).toBe('Sirius')
  await act(async () => renderer.unmount())
})

test('Galaxy loads Exobiology and refreshes it for cartography journal events', async () => {
  const response = explorationResponse()
  const events = new FakeEventHub()
  const api = { getExplorationLedger: vi.fn().mockResolvedValue(response) } as unknown as PhoenixApi
  let snapshot: GalaxyControllerSnapshot | undefined

  function Probe() { snapshot = useGalaxyController(api, events, 'exobiology'); return null }
  const renderer = await act(async () => create(<Probe />))

  expect(api.getExplorationLedger).toHaveBeenCalledTimes(1)
  expect(snapshot).toEqual({ exploration: response, status: 'ready' })

  await act(async () => {
    events.emit('activity-entry', activity('MissionCompleted'))
    await Promise.resolve()
  })
  expect(api.getExplorationLedger).toHaveBeenCalledTimes(1)

  await act(async () => {
    events.emit('activity-entry', activity('ScanOrganic'))
    await Promise.resolve()
  })
  expect(api.getExplorationLedger).toHaveBeenCalledTimes(2)
  await act(async () => renderer.unmount())
})

function explorationResponse(): ExplorationLedgerResponse {
  return {
    systems: [],
    totals: { biologicalSignals: 0, bodies: 0, geologicalSignals: 0, mappedBodies: 0, samplesCompleted: 0, scannedBodies: 0, systems: 0 }
  }
}

function activity(event: string): ActivityLogEntry {
  return { actionable: false, data: {}, event, id: event, importance: 'routine', ingestedAt: '2026-08-16T12:00:00.000Z', source: 'journal', timestamp: '2026-08-16T12:00:00.000Z' }
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
