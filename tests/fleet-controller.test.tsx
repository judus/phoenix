import { act, create } from 'react-test-renderer'
import { beforeAll, expect, test, vi } from 'vitest'
import type { ActivityLogEntry } from '@phoenix/contracts'
import type { PhoenixApi } from '../apps/web/src/application/api/phoenix-api.js'
import type { PhoenixEventHub, PhoenixEventMap, PhoenixEventName } from '../apps/web/src/application/events/phoenix-event-hub.js'
import { useFleetController } from '../apps/web/src/features/fleet/use-fleet-controller.js'
import { fleetFixture } from './fixtures/fleet-fixture.js'

beforeAll(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }) })

test('Fleet queries only the active family data and refreshes retained records on activity', async () => {
  const events = new FakeEventHub()
  const api = {
    getFleet: vi.fn().mockResolvedValue(fleetFixture()),
    getShipCatalogue: vi.fn().mockResolvedValue({ ships: [] })
  } as unknown as PhoenixApi
  let view: 'overview' | 'current-overview' = 'overview'

  function Probe() { useFleetController(api, events, view); return null }
  const renderer = await act(async () => create(<Probe />))
  expect(api.getFleet).toHaveBeenCalledTimes(1)
  expect(api.getShipCatalogue).not.toHaveBeenCalled()

  await act(async () => {
    events.emit('activity-entry', activity())
    await Promise.resolve()
  })
  expect(api.getFleet).toHaveBeenCalledTimes(2)

  view = 'current-overview'
  await act(async () => renderer.update(<Probe />))
  expect(api.getFleet).toHaveBeenCalledTimes(2)
  expect(api.getShipCatalogue).not.toHaveBeenCalled()
  await act(async () => renderer.unmount())
})

function activity(): ActivityLogEntry {
  return { actionable: false, data: {}, event: 'shipyard', id: 'activity', importance: 'notable', ingestedAt: '2026-08-16T12:00:00.000Z', source: 'journal', timestamp: '2026-08-16T12:00:00.000Z' }
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
