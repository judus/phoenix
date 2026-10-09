import { renderWithAct } from './support/render-with-act.js'
import { act, create } from 'react-test-renderer'
import { beforeAll, expect, test, vi } from 'vitest'
import type { CommunicationMessage, CommunicationsResponse } from '@phoenix/contracts'
import type { PhoenixApi } from '../apps/web/src/application/api/phoenix-api.js'
import { FakeEventHub } from './support/fake-event-hub.js'
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
  const renderer = await renderWithAct(<Probe />)

  expect(api.getCommunications).toHaveBeenCalledWith('traffic', 500, expect.any(AbortSignal))
  const initialSignal = vi.mocked(api.getCommunications).mock.calls[0]?.[2]
  expect(snapshot).toEqual({ communications: response, status: 'ready' })

  await act(async () => { events.emit('communication-message', message()); await Promise.resolve() })
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

function message(): CommunicationMessage {
  return { channel: 'starsystem', direction: 'inbound', id: 'message-1', message: 'o7', rawMessage: null, rawSender: 'CMDR Ada', recipient: null, sender: 'CMDR Ada', senderKind: 'commander', sourceEvent: 'ReceiveText', timestamp: '2026-08-16T12:00:00.000Z', view: 'traffic' }
}
