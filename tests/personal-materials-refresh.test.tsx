import { act, create } from 'react-test-renderer'
import { createEmptyRuntimeState, type RuntimeState } from '@phoenix/contracts'
import { beforeAll, expect, test, vi } from 'vitest'
import type { PhoenixApi } from '../apps/web/src/application/api/phoenix-api.js'
import type { PhoenixEventHub, PhoenixEventMap, PhoenixEventName } from '../apps/web/src/application/events/phoenix-event-hub.js'
import { usePersonalMaterialsController } from '../apps/web/src/features/equipment/use-personal-materials-controller.js'

beforeAll(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }) })

function fixture() {
  const listeners = new Set<(state: RuntimeState) => void>()
  const events = {
    subscribe<K extends PhoenixEventName>(name: K, listener: (payload: PhoenixEventMap[K]) => void) {
      expect(name).toBe('runtime-state')
      listeners.add(listener as (state: RuntimeState) => void)
      return () => { listeners.delete(listener as (state: RuntimeState) => void) }
    }
  } as PhoenixEventHub
  const api = { getPersonalMaterialInventory: vi.fn().mockResolvedValue({ schemaVersion: 1, groups: [] }) } as unknown as PhoenixApi
  const emit = async (state: RuntimeState) => {
    await act(async () => { for (const listener of listeners) listener(structuredClone(state)) })
  }
  return { api, emit, events, listeners }
}

test('personal materials suppress identical SSE inventory slices but preserve same-time counts, labels, mission tags and timestamps', async () => {
  const { api, events, emit, listeners } = fixture()
  function Probe() { usePersonalMaterialsController(api, events, true); return null }
  let renderer!: ReturnType<typeof create>
  await act(async () => { renderer = create(<Probe />) })
  const runtime = createEmptyRuntimeState()
  await emit(runtime)
  // First stream event conservatively reconciles with the bootstrap request.
  expect(api.getPersonalMaterialInventory).toHaveBeenCalledTimes(2)
  for (let revision = 1; revision <= 5; revision++) await emit({ ...runtime, revision })
  expect(api.getPersonalMaterialInventory).toHaveBeenCalledTimes(2)
  runtime.inventory.shipLocker = {
    updatedAt: '2026-10-04T12:00:00.000Z', items: [], consumables: [], data: [],
    components: [{ id: 'weaponcomponent', label: 'Weapon Component', count: 1, ownerId: null, missionId: null }]
  }
  await emit(runtime)
  runtime.inventory.shipLocker.components[0]!.count = 2
  await emit(runtime)
  runtime.inventory.shipLocker.components[0]!.label = 'Changed Label'
  await emit(runtime)
  runtime.inventory.shipLocker.components[0]!.missionId = 42
  await emit(runtime)
  runtime.inventory.shipLocker.updatedAt = '2026-10-04T12:00:01.000Z'
  await emit(runtime)
  runtime.inventory.backpack = structuredClone(runtime.inventory.shipLocker)
  await emit(runtime)
  runtime.inventory.backpack = null
  await emit(runtime)
  expect(api.getPersonalMaterialInventory).toHaveBeenCalledTimes(9)
  await act(async () => renderer.unmount())
  expect(listeners.size).toBe(0)
})

test('failed personal material refresh can retry unchanged state, and activation/API changes still reload', async () => {
  const { api, events, emit } = fixture()
  let active = true
  let currentApi = api
  function Probe() { usePersonalMaterialsController(currentApi, events, active); return null }
  let renderer!: ReturnType<typeof create>
  await act(async () => { renderer = create(<Probe />) })
  vi.mocked(api.getPersonalMaterialInventory).mockRejectedValueOnce(new Error('Temporary failure'))
  const runtime = createEmptyRuntimeState()
  await emit(runtime)
  await emit(runtime)
  expect(api.getPersonalMaterialInventory).toHaveBeenCalledTimes(3)
  active = false
  await act(async () => renderer.update(<Probe />))
  await emit(runtime)
  expect(api.getPersonalMaterialInventory).toHaveBeenCalledTimes(3)
  active = true
  await act(async () => renderer.update(<Probe />))
  expect(api.getPersonalMaterialInventory).toHaveBeenCalledTimes(4)
  currentApi = fixture().api
  await act(async () => renderer.update(<Probe />))
  expect(currentApi.getPersonalMaterialInventory).toHaveBeenCalledTimes(1)
  await act(async () => renderer.unmount())
})
