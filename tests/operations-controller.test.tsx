import { renderWithAct } from './support/render-with-act.js'
import { act, create } from 'react-test-renderer'
import { beforeAll, expect, test, vi } from 'vitest'
import type { ActivityLogEntry, CommunityGoalsResponse, ExplorationLedgerResponse, MissionsResponse } from '@phoenix/contracts'
import type { PhoenixApi } from '../apps/web/src/application/api/phoenix-api.js'
import { FakeEventHub } from './support/fake-event-hub.js'
import { useActivitiesController, type ActivitiesControllerSnapshot, type ActivitiesView } from '../apps/web/src/features/activities/use-activities-controller.js'

beforeAll(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }) })

test('Activities refreshes mission briefs for journal changes and inventory file observations', async () => {
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

  await act(async () => {
    events.emit('activity-entry', { ...activity('inventory.backpack_changed'), source: 'runtime' })
    await Promise.resolve()
  })
  expect(api.getMissions).toHaveBeenCalledTimes(3)

  view = 'powerplay'
  await act(async () => renderer.update(<Probe />))
  expect(snapshot).toEqual({ status: 'ready' })
  expect(api.getMissions).toHaveBeenCalledTimes(3)
  await act(async () => renderer.unmount())
})

test('Community Goals poll after a delayed fetch and cache expiry, canceling on navigation', async () => {
  vi.useFakeTimers()
  const events = new FakeEventHub()
  const response: CommunityGoalsResponse = { goals: [], fetchedAt: '2026-10-07T12:00:00Z', cache: 'fresh' }
  let finishCold: ((value: CommunityGoalsResponse) => void) | undefined
  const api = { getCommunityGoals: vi.fn().mockImplementationOnce(() => new Promise(resolve => { finishCold = resolve })), getMissions: vi.fn() } as unknown as PhoenixApi
  let snapshot: ActivitiesControllerSnapshot | undefined
  let view: ActivitiesView = 'community-goals'
  function Probe() { snapshot = useActivitiesController(api, events, view); return null }
  const renderer = await renderWithAct(<Probe />)
  try {
    expect(snapshot).toEqual({ status: 'loading' })
    await act(async () => { vi.advanceTimersByTime(2000) })
    await act(async () => finishCold?.(response))
    expect(snapshot).toEqual({ status: 'ready', communityGoals: response })
    expect(api.getMissions).not.toHaveBeenCalled()
    await act(async () => events.emit('activity-entry', activity('MissionCompleted')))
    expect(api.getCommunityGoals).toHaveBeenCalledTimes(1)
    let finish: ((value: CommunityGoalsResponse) => void) | undefined
    vi.mocked(api.getCommunityGoals).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    await act(async () => { vi.advanceTimersByTime(15 * 60 * 1000) })
    expect(api.getCommunityGoals).toHaveBeenCalledTimes(1)
    await act(async () => { vi.advanceTimersByTime(1000) })
    const signal = vi.mocked(api.getCommunityGoals).mock.calls[1]![0]!
    view = 'powerplay'
    await act(async () => renderer.update(<Probe />))
    expect(signal.aborted).toBe(true)
    await act(async () => finish?.(response))
    expect(snapshot).toEqual({ status: 'ready' })
    await act(async () => { vi.advanceTimersByTime(30 * 60 * 1000) })
    expect(api.getCommunityGoals).toHaveBeenCalledTimes(2)
  } finally {
    await act(async () => renderer.unmount())
    vi.useRealTimers()
  }
})

function missionsResponse(): MissionsResponse {
  return { missions: [], snapshotAt: null, summary: { abandoned: 0, active: 0, completed: 0, failed: 0, partial: 0, total: 0, unknown: 0 } }
}

test('Colonisation refreshes only construction events and history completion, retaining observations on refresh failure', async () => {
  const data = { depots: [], claims: [], contributions: [], retainedContributions: 0 }
  const events = new FakeEventHub()
  const api = { getColonisation: vi.fn().mockResolvedValue(data), getMissions: vi.fn() } as unknown as PhoenixApi
  let snapshot!: ActivitiesControllerSnapshot
  function Probe() { snapshot = useActivitiesController(api, events, 'colonisation'); return null }
  const renderer = await renderWithAct(<Probe />)
  expect(snapshot).toEqual({ colonisation: data, status: 'ready' })
  await act(async () => events.emit('activity-entry', activity('MissionAccepted')))
  expect(api.getColonisation).toHaveBeenCalledTimes(1)
  await act(async () => events.emit('journal-history-loaded', null))
  expect(api.getColonisation).toHaveBeenCalledTimes(2)
  vi.mocked(api.getColonisation).mockRejectedValueOnce(new Error('Read failed'))
  await act(async () => events.emit('activity-entry', activity('ColonisationContribution')))
  expect(snapshot).toEqual({ colonisation: data, status: 'ready', error: 'Read failed' })
  vi.mocked(api.getColonisation).mockRejectedValueOnce('offline')
  await act(async () => events.emit('activity-entry', activity('ColonisationConstructionDepot')))
  expect(snapshot.error).toBe('Construction records unavailable.')
  await act(async () => renderer.unmount())
  await act(async () => events.emit('journal-history-loaded', null))
  expect(api.getColonisation).toHaveBeenCalledTimes(4)
  expect(api.getMissions).not.toHaveBeenCalled()
})

function activity(event: string): ActivityLogEntry {
  return { actionable: false, data: {}, event, id: event, importance: 'info', ingestedAt: '2026-08-16T12:00:00.000Z', source: 'journal', timestamp: '2026-08-16T12:00:00.000Z' }
}

test('Activities loads Exobiology and refreshes only for exploration journal events', async () => {
  const response: ExplorationLedgerResponse = {
    systems: [], totals: { biologicalSignals: 0, bodies: 0, geologicalSignals: 0, mappedBodies: 0, samplesCompleted: 0, scannedBodies: 0, systems: 0 }
  }
  const events = new FakeEventHub()
  const api = { getExplorationLedger: vi.fn().mockResolvedValue(response), getMissions: vi.fn() } as unknown as PhoenixApi
  let snapshot: ActivitiesControllerSnapshot | undefined
  function Probe() { snapshot = useActivitiesController(api, events, 'exobiology'); return null }
  const renderer = await renderWithAct(<Probe />)
  try {
    expect(snapshot).toEqual({ exploration: response, status: 'ready' })
    expect(api.getExplorationLedger).toHaveBeenCalledOnce()
    await act(async () => events.emit('activity-entry', activity('MissionCompleted')))
    await act(async () => events.emit('activity-entry', { ...activity('ScanOrganic'), source: 'runtime' }))
    expect(api.getExplorationLedger).toHaveBeenCalledOnce()
    for (const event of ['ScanOrganic', 'SAASignalsFound', 'Scan']) {
      await act(async () => events.emit('activity-entry', activity(event)))
    }
    expect(api.getExplorationLedger).toHaveBeenCalledTimes(4)
    expect(api.getMissions).not.toHaveBeenCalled()
  } finally { await act(async () => renderer.unmount()) }
  await act(async () => events.emit('activity-entry', activity('ScanOrganic')))
  expect(api.getExplorationLedger).toHaveBeenCalledTimes(4)
})
