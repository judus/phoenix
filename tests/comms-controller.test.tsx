import { act, create } from 'react-test-renderer'
import { beforeAll, expect, test, vi } from 'vitest'
import type { ActivityLogEntry, CommunicationsResponse } from '@phoenix/contracts'
import type { PhoenixApi } from '../apps/web/src/application/api/phoenix-api.js'
import type { PhoenixEventHub, PhoenixEventMap, PhoenixEventName } from '../apps/web/src/application/events/phoenix-event-hub.js'
import { useCommsController, type CommsControllerSnapshot, type CommsView } from '../apps/web/src/features/comms/use-comms-controller.js'

beforeAll(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }) })

test('Comms selects a focused transport and refreshes journal-backed views for text events', async () => {
  const response = communications()
  const events = new FakeEventHub()
  const api = {
    getCommunications: vi.fn().mockResolvedValue(response),
    getGalnetNews: vi.fn(),
    getActions: vi.fn()
  } as unknown as PhoenixApi
  let snapshot: CommsControllerSnapshot | undefined
  let view: CommsView = 'traffic'

  function Probe() { snapshot = useCommsController(api, events, view); return null }
  const renderer = await act(async () => create(<Probe />))

  expect(api.getCommunications).toHaveBeenCalledWith('traffic', 500, expect.any(AbortSignal))
  const initialSignal = vi.mocked(api.getCommunications).mock.calls[0]?.[2]
  expect(snapshot).toEqual({ communications: response, status: 'ready' })

  await act(async () => { events.emit('activity-entry', activity('Location')); await Promise.resolve() })
  expect(api.getCommunications).toHaveBeenCalledTimes(1)
  await act(async () => { events.emit('activity-entry', activity('ReceiveText')); await Promise.resolve() })
  expect(api.getCommunications).toHaveBeenCalledTimes(2)
  expect(initialSignal?.aborted).toBe(true)

  view = 'galnet'
  vi.mocked(api.getGalnetNews).mockResolvedValue({ articles: [], cache: 'fresh', fetchedAt: '2026-08-16T12:00:00.000Z' })
  await act(async () => renderer.update(<Probe />))
  expect(api.getGalnetNews).toHaveBeenCalledWith(40, expect.any(AbortSignal))
  expect(api.getCommunications).toHaveBeenCalledTimes(2)
  await act(async () => renderer.unmount())
})

function communications(): CommunicationsResponse {
  return { contacts: [], messages: [], summary: { inbound: 0, inbox: 0, outbound: 0, total: 0, traffic: 0 }, view: 'traffic' }
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
