import { renderWithAct } from './support/render-with-act.js'
import { act, create } from 'react-test-renderer'
import { beforeAll, expect, test, vi } from 'vitest'
import type { ActivityLogEntry, MissionsResponse } from '@phoenix/contracts'
import type { PhoenixApi } from '../apps/web/src/application/api/phoenix-api.js'
import { FakeEventHub } from './support/fake-event-hub.js'
import { useActivitiesController, type ActivitiesControllerSnapshot, type ActivitiesView } from '../apps/web/src/features/activities/use-activities-controller.js'

beforeAll(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }) })

test('Activities loads missions only where used and refreshes only for mission journal events', async () => {
  const response = missionsResponse()
  const events = new FakeEventHub()
  const api = { getMissions: vi.fn().mockResolvedValue(response) } as unknown as PhoenixApi
  let snapshot: ActivitiesControllerSnapshot | undefined
  let view: ActivitiesView = 'missions'

  function Probe() { snapshot = useActivitiesController(api, events, view); return null }
  const renderer = await renderWithAct(<Probe />)

  expect(api.getMissions).toHaveBeenCalledTimes(1)
  expect(snapshot).toEqual({ missions: response, status: 'ready' })

  await act(async () => {
    events.emit('activity-entry', activity('Location'))
    await Promise.resolve()
  })
  expect(api.getMissions).toHaveBeenCalledTimes(1)

  await act(async () => {
    events.emit('activity-entry', activity('MissionCompleted'))
    await Promise.resolve()
  })
  expect(api.getMissions).toHaveBeenCalledTimes(2)

  view = 'objectives'
  await act(async () => renderer.update(<Probe />))
  expect(snapshot).toEqual({ status: 'ready' })
  expect(api.getMissions).toHaveBeenCalledTimes(2)
  await act(async () => renderer.unmount())
})

function missionsResponse(): MissionsResponse {
  return { missions: [], snapshotAt: null, summary: { abandoned: 0, active: 0, completed: 0, failed: 0, partial: 0, total: 0, unknown: 0 } }
}

function activity(event: string): ActivityLogEntry {
  return { actionable: false, data: {}, event, id: event, importance: 'info', ingestedAt: '2026-08-16T12:00:00.000Z', source: 'journal', timestamp: '2026-08-16T12:00:00.000Z' }
}
