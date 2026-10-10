import { renderWithAct } from './support/render-with-act.js'
import { act, create } from 'react-test-renderer'
import { beforeAll, expect, test, vi } from 'vitest'
import type { ActivityLogEntry } from '@phoenix/contracts'
import type { PhoenixApi } from '../apps/web/src/application/api/phoenix-api.js'
import { FakeEventHub } from './support/fake-event-hub.js'
import { useFleetController } from '../apps/web/src/features/fleet/use-fleet-controller.js'
import { fleetFixture } from './fixtures/fleet-fixture.js'

beforeAll(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }) })

test('Fleet queries only the active family data and refreshes retained records on activity', async () => {
  const events = new FakeEventHub()
  const api = {
    getActions: vi.fn().mockResolvedValue({ actions: [], backend: {}, bindingSource: {} }),
    getFleet: vi.fn().mockResolvedValue(fleetFixture()),
    getModuleSettings: vi.fn().mockResolvedValue({
      currentShip: { moduleHealthAlertThreshold: 90 },
      numpadCommands: { inputAdapter: 'browser', presentation: 'tiles', alwaysConfirm: false, cancelAfterMs: 5000 }
    }),
    getShipCatalogue: vi.fn().mockResolvedValue({ ships: [] })
  } as unknown as PhoenixApi
  let view: 'overview' | 'current-overview' = 'overview'

  function Probe() { useFleetController(api, events, view); return null }
  const renderer = await renderWithAct(<Probe />)
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
  expect(api.getActions).toHaveBeenCalledTimes(1)
  expect(api.getModuleSettings).toHaveBeenCalledTimes(1)
  await act(async () => renderer.unmount())
})

function activity(): ActivityLogEntry {
  return { actionable: false, data: {}, event: 'shipyard', id: 'activity', importance: 'notable', ingestedAt: '2026-08-16T12:00:00.000Z', source: 'journal', timestamp: '2026-08-16T12:00:00.000Z' }
}

test('carrier page refreshes relevant management events and completed history, not unrelated activity; unsubscribes on departure', async () => {
  const events = new FakeEventHub()
  const api = { getFleet: vi.fn().mockResolvedValue(fleetFixture()) } as unknown as PhoenixApi
  function Probe() { useFleetController(api, events, 'carriers'); return null }
  const renderer = await renderWithAct(<Probe />)
  await act(async () => { events.emit('activity-entry', activity()) })
  expect(api.getFleet).toHaveBeenCalledTimes(1)
  await act(async () => { events.emit('activity-entry', { ...activity(), event: 'CarrierStats' }) })
  expect(api.getFleet).toHaveBeenCalledTimes(2)
  await act(async () => { events.emit('journal-history-loaded', null) })
  expect(api.getFleet).toHaveBeenCalledTimes(3)
  await act(async () => { events.emit('activity-entry', { ...activity(), event: 'StoredShips' }) })
  expect(api.getFleet).toHaveBeenCalledTimes(4)
  await act(async () => renderer.unmount())
  await act(async () => { events.emit('journal-history-loaded', null) })
  expect(api.getFleet).toHaveBeenCalledTimes(4)
})
