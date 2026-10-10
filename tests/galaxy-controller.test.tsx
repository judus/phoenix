import { renderWithAct } from './support/render-with-act.js'
import { act, create } from 'react-test-renderer'
import { beforeAll, expect, test, vi } from 'vitest'
import type { CartographicSystem } from '@phoenix/contracts'
import type { PhoenixApi } from '../apps/web/src/application/api/phoenix-api.js'
import { FakeEventHub } from './support/fake-event-hub.js'
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
  const renderer = await renderWithAct(<Probe />)

  expect(api.getNavigationRoute).toHaveBeenCalledTimes(1)
  expect(api.getActions).toHaveBeenCalledTimes(1)
  expect(api.getSystemCartography).not.toHaveBeenCalled()
  expect(snapshot).toMatchObject({ route: initialRoute, status: 'ready' })

  await act(async () => events.emit('navigation-route', updatedRoute))
  expect(snapshot).toMatchObject({ route: updatedRoute, status: 'ready' })
  await act(async () => renderer.unmount())
})

test.each(['route', 'atlas', 'database'] as const)('a live plotted route cancels and supersedes an older %s request', async view => {
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

  function Probe() { snapshot = useGalaxyController(api, events, view); return null }
  const renderer = await renderWithAct(<Probe />)

  await act(async () => events.emit('navigation-route', updatedRoute))
  expect(requestSignal?.aborted).toBe(true)
  expect(snapshot).toMatchObject({ route: updatedRoute, status: 'ready' })

  await act(async () => { resolveRoute?.({ ...updatedRoute, route: [{ ...updatedRoute.route[0]!, system: 'Stale' }] }); await Promise.resolve() })
  expect(snapshot?.route?.route[0]?.system).toBe('Sirius')
  await act(async () => events.emit('navigation-route', { timestamp: null, route: [] }))
  expect(snapshot?.route?.route).toEqual([])
  if (view !== 'route') expect(api.getActions).not.toHaveBeenCalled()
  await act(async () => renderer.unmount())
})

test('Galaxy replaces the current schematic with matching live cartography updates', async () => {
  const initial = cartographicSystem('Sol', 0)
  const updated = cartographicSystem('Sol', 1)
  const api = {
    getSystemCartography: vi.fn().mockResolvedValue({ cache: 'fresh', system: initial })
  } as unknown as PhoenixApi
  const events = new FakeEventHub()
  let snapshot: GalaxyControllerSnapshot | undefined

  function Probe() { snapshot = useGalaxyController(api, events, 'system', 'Sol'); return null }
  const renderer = await renderWithAct(<Probe />)

  expect(snapshot?.lookup?.system.scanProgress.knownBodies).toBe(0)
  await act(async () => events.emit('cartography-updated', {
    system: updated,
    systemName: 'SOL',
    updatedAt: '2026-08-16T12:01:00.000Z'
  }))

  expect(api.getSystemCartography).toHaveBeenCalledTimes(1)
  expect(snapshot).toMatchObject({
    lookup: { cache: 'local', system: { scanProgress: { knownBodies: 1 } } },
    status: 'ready'
  })

  await act(async () => events.emit('cartography-updated', {
    system: cartographicSystem('Sirius', 2),
    systemName: 'Sirius',
    updatedAt: '2026-08-16T12:02:00.000Z'
  }))
  expect(snapshot?.lookup?.system.name).toBe('Sol')
  await act(async () => renderer.unmount())
})

function cartographicSystem(name: string, knownBodies: number): CartographicSystem {
  return {
    schemaVersion: 5,
    name,
    address: null,
    position: null,
    permitRequired: null,
    permitName: null,
    information: {
      allegiance: null,
      government: null,
      security: null,
      state: null,
      primaryEconomy: null,
      secondaryEconomy: null,
      population: null,
      controllingFaction: null
    },
    primaryStar: null,
    bodies: [],
    stations: [],
    scanProgress: { knownBodies, reportedBodies: null, percent: null },
    localSystem: null,
    provenance: { edsm: null, journal: { updatedAt: '2026-08-16T12:00:00.000Z' } },
    raw: { system: {}, bodies: {}, stations: {} }
  }
}
