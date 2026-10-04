import { act, create } from 'react-test-renderer'
import { createEmptyRuntimeState, type RuntimeState } from '@phoenix/contracts'
import { beforeAll, expect, test, vi } from 'vitest'
import type { PhoenixApi } from '../apps/web/src/application/api/phoenix-api.js'
import type { PhoenixEventHub, PhoenixEventMap, PhoenixEventName } from '../apps/web/src/application/events/phoenix-event-hub.js'
import { engineeringRuntimeFingerprint } from '../apps/web/src/features/engineering/engineering-runtime-fingerprint.js'
import { useEngineeringController, type EngineeringControllerSnapshot, type EngineeringRoute } from '../apps/web/src/features/engineering/use-engineering-controller.js'

beforeAll(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }) })

function state(): RuntimeState {
  const runtime = createEmptyRuntimeState()
  runtime.inventory.materials = { updatedAt: '2026-10-04T12:00:00.000Z', raw: [], manufactured: [], encoded: [
    { id: 'data', label: 'Data', count: 1 }
  ] }
  runtime.commander.engineers = [{ id: 1, name: 'Engineer', status: 'Unlocked', rank: 1, rankProgress: 0 }]
  runtime.system.position = [1, 2, 3]
  runtime.ship.modules = [{
    slotId: 'Slot1', slotGroup: 'optional', slotSize: 1, expectedSlot: null,
    moduleId: 'Module', moduleSize: 1, moduleClass: 1, definition: null, enabled: true,
    priority: 1, health: 1, value: null, ammo: null, engineering: null
  }]
  return runtime
}

const routes: Array<{ route: EngineeringRoute, sources: string[] }> = [
  { route: { kind: 'information', section: 'engineering', view: 'project-new' }, sources: [] },
  { route: { kind: 'information', section: 'engineering', view: 'projects' }, sources: ['materials'] },
  { route: { kind: 'information', section: 'engineering', view: 'project-detail', selectedProjectId: 'one' }, sources: ['materials'] },
  { route: { kind: 'information', section: 'engineering', view: 'experimental-effects' }, sources: ['materials'] },
  { route: { kind: 'information', section: 'engineering', view: 'materials-xeno' }, sources: ['materials'] },
  { route: { kind: 'information', section: 'engineering', view: 'materials-encoded' }, sources: ['materials'] },
  { route: { kind: 'information', section: 'engineering', view: 'engineers' }, sources: ['engineers', 'position'] },
  { route: { kind: 'information', section: 'engineering', view: 'blueprints' }, sources: ['modules'] },
  { route: { kind: 'information', section: 'engineering', view: 'blueprints', selectedBlueprintSymbol: 'one' }, sources: ['materials', 'modules', 'engineers', 'position'] },
  { route: { kind: 'information', section: 'engineering', view: 'project-add-blueprint', selectedBlueprintSymbol: 'one' }, sources: ['materials', 'modules', 'engineers', 'position'] }
]

const change: Record<string, (runtime: RuntimeState) => void> = {
  materials: runtime => { runtime.inventory.materials!.encoded[0]!.count++ },
  modules: runtime => { runtime.ship.modules[0]!.engineering = { engineer: null, engineerId: null, blueprintId: 1,
    blueprintName: 'Blueprint', level: 3, quality: null, experimentalEffect: 'Effect', experimentalEffectLabel: 'Effect Label', modifiers: [] } },
  engineers: runtime => { runtime.commander.engineers[0]!.rank++ },
  position: runtime => { runtime.system.position![0]++ }
}

test.each(routes)('runtime key follows server sources for $route.view', ({ route, sources }) => {
  const runtime = state()
  const original = engineeringRuntimeFingerprint(route, runtime)
  const unrelated = structuredClone(runtime)
  unrelated.revision++
  unrelated.ship.hullHealth = 0.5
  expect(engineeringRuntimeFingerprint(route, unrelated)).toBe(original)
  for (const [source, mutate] of Object.entries(change)) {
    const changed = structuredClone(runtime)
    mutate(changed)
    expect(engineeringRuntimeFingerprint(route, changed) !== original).toBe(sources.includes(source))
  }
})

test.each(['raw', 'manufactured', 'encoded'] as const)('category %s key tracks counts and observed timestamp, not other categories', category => {
  const runtime = state()
  for (const candidate of ['raw', 'manufactured', 'encoded'] as const) runtime.inventory.materials![candidate] = [{ id: candidate, label: candidate, count: 1 }]
  const route: EngineeringRoute = { kind: 'information', section: 'engineering', view: `materials-${category}` }
  const original = engineeringRuntimeFingerprint(route, runtime)
  for (const candidate of ['raw', 'manufactured', 'encoded'] as const) {
    const changed = structuredClone(runtime)
    changed.inventory.materials![candidate][0]!.count++
    expect(engineeringRuntimeFingerprint(route, changed) !== original).toBe(candidate === category)
  }
  runtime.inventory.materials!.updatedAt = '2026-10-04T12:00:01.000Z'
  expect(engineeringRuntimeFingerprint(route, runtime)).not.toBe(original)
})

function eventFixture() {
  const listeners = new Map<string, Set<(payload: unknown) => void>>()
  const events = {
    subscribe<K extends PhoenixEventName>(name: K, listener: (payload: PhoenixEventMap[K]) => void) {
      const entries = listeners.get(name) ?? new Set()
      entries.add(listener as (payload: unknown) => void)
      listeners.set(name, entries)
      return () => { entries.delete(listener as (payload: unknown) => void) }
    }
  } as PhoenixEventHub
  const emit = (name: string, payload: unknown) => { for (const listener of listeners.get(name) ?? []) listener(payload) }
  return { events, emit, listeners }
}

test('engineering recovers a transient failed refresh on the next unrelated event without repeated in-flight retries', async () => {
  const api = { getEngineeringMaterials: vi.fn().mockRejectedValueOnce(new Error('Temporary failure')).mockResolvedValue({ materials: [] }) } as unknown as PhoenixApi
  const { events, emit, listeners } = eventFixture()
  const runtime = state()
  const route: EngineeringRoute = { kind: 'information', section: 'engineering', view: 'materials-encoded' }
  let snapshot: EngineeringControllerSnapshot | undefined
  function Probe() { snapshot = useEngineeringController(api, route, engineeringRuntimeFingerprint(route, runtime), events); return null }
  let renderer!: ReturnType<typeof create>
  await act(async () => { renderer = create(<Probe />) })
  expect(snapshot?.status).toBe('error')
  await act(async () => {
    for (let index = 0; index < 10; index++) emit('runtime-state', { ...runtime, revision: index + 1 })
    renderer.update(<Probe />)
  })
  expect(api.getEngineeringMaterials).toHaveBeenCalledTimes(2)
  expect(snapshot?.status).toBe('ready')
  await act(async () => { emit('runtime-state', { ...runtime, revision: 11 }); renderer.update(<Probe />) })
  expect(api.getEngineeringMaterials).toHaveBeenCalledTimes(2)
  await act(async () => renderer.unmount())
  expect([...listeners.values()].every(entries => entries.size === 0)).toBe(true)
})

test('unchanged runtime does not reload projects, but inventory changes and project events do', async () => {
  const api = {
    getEngineeringProjects: vi.fn().mockResolvedValue({ schemaVersion: 1, projects: [] }),
    getEngineeringMaterialWatchlist: vi.fn().mockResolvedValue({ materials: [] })
  } as unknown as PhoenixApi
  const { events, emit } = eventFixture()
  let runtime = state()
  const route: EngineeringRoute = { kind: 'information', section: 'engineering', view: 'projects' }
  function Probe() { useEngineeringController(api, route, engineeringRuntimeFingerprint(route, runtime), events); return null }
  let renderer!: ReturnType<typeof create>
  await act(async () => { renderer = create(<Probe />) })
  runtime = structuredClone(runtime)
  runtime.revision++
  await act(async () => renderer.update(<Probe />))
  expect(api.getEngineeringProjects).toHaveBeenCalledTimes(1)
  runtime.inventory.materials!.encoded[0]!.count++
  await act(async () => renderer.update(<Probe />))
  expect(api.getEngineeringProjects).toHaveBeenCalledTimes(2)
  await act(async () => emit('engineering-projects-changed', {}))
  expect(api.getEngineeringProjects).toHaveBeenCalledTimes(3)
  expect(api.getEngineeringMaterialWatchlist).toHaveBeenCalledTimes(3)
  await act(async () => renderer.unmount())
})

test('events arriving in separate turns do not restart an in-flight failure retry', async () => {
  let finish!: (value: unknown) => void
  const retry = new Promise(resolve => { finish = resolve })
  const api = { getEngineeringMaterials: vi.fn().mockRejectedValueOnce(new Error('Temporary failure')).mockReturnValue(retry) } as unknown as PhoenixApi
  const { events, emit } = eventFixture()
  const runtime = state()
  const route: EngineeringRoute = { kind: 'information', section: 'engineering', view: 'materials-encoded' }
  function Probe() { useEngineeringController(api, route, engineeringRuntimeFingerprint(route, runtime), events); return null }
  let renderer!: ReturnType<typeof create>
  await act(async () => { renderer = create(<Probe />) })
  await act(async () => emit('runtime-state', runtime))
  for (let index = 0; index < 3; index++) await act(async () => emit('runtime-state', { ...runtime, revision: index + 1 }))
  expect(api.getEngineeringMaterials).toHaveBeenCalledTimes(2)
  await act(async () => finish({ materials: [] }))
  await act(async () => emit('runtime-state', { ...runtime, revision: 4 }))
  expect(api.getEngineeringMaterials).toHaveBeenCalledTimes(2)
  await act(async () => renderer.unmount())
})

test('an obsolete noncooperative request rejection cannot arm retries on the replacement route', async () => {
  let reject!: (cause: unknown) => void
  const old = new Promise((_, fail) => { reject = fail })
  const api = {
    getEngineeringMaterials: vi.fn().mockReturnValue(old),
    getEngineeringEngineers: vi.fn().mockResolvedValue({ engineers: [] })
  } as unknown as PhoenixApi
  const { events, emit } = eventFixture()
  const runtime = state()
  let route: EngineeringRoute = { kind: 'information', section: 'engineering', view: 'materials-encoded' }
  let snapshot: EngineeringControllerSnapshot | undefined
  function Probe() { snapshot = useEngineeringController(api, route, engineeringRuntimeFingerprint(route, runtime), events); return null }
  let renderer!: ReturnType<typeof create>
  await act(async () => { renderer = create(<Probe />) })
  route = { kind: 'information', section: 'engineering', view: 'engineers' }
  await act(async () => renderer.update(<Probe />))
  await act(async () => reject(new Error('Obsolete failure')))
  await act(async () => emit('runtime-state', { ...runtime, revision: 1 }))
  expect(api.getEngineeringEngineers).toHaveBeenCalledTimes(1)
  expect(snapshot).toMatchObject({ status: 'ready', engineers: { engineers: [] } })
  expect(snapshot?.error).toBeUndefined()
  await act(async () => renderer.unmount())
})
