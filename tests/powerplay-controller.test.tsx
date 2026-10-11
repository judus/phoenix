import { act } from 'react-test-renderer'
import { beforeAll, expect, test, vi } from 'vitest'
import type { ActivityLogEntry, PowerplayResponse } from '@phoenix/contracts'
import type { PhoenixApi } from '../apps/web/src/application/api/phoenix-api.js'
import { usePowerplayController, type PowerplayController } from '../apps/web/src/features/activities/use-powerplay-controller.js'
import { FakeEventHub } from './support/fake-event-hub.js'
import { renderWithAct } from './support/render-with-act.js'

beforeAll(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }) })

test('Powerplay refreshes relevant events, cancels stale reads after target writes and retains cached state on remount', async () => {
  const response: PowerplayResponse = {
    pledge: { power: null, status: 'unknown', rank: null, merits: null, pledgedAt: null, updatedAt: null, rankAt: null, meritsAt: null },
    entries: [], retained: 0, target: null, targetProgress: null
  }
  const events = new FakeEventHub()
  const api = { getPowerplay: vi.fn().mockResolvedValue(response), savePowerplayTarget: vi.fn() } as unknown as PhoenixApi
  let snapshot!: PowerplayController
  function Probe() { snapshot = usePowerplayController(api, events); return null }
  let renderer = await renderWithAct(<Probe />)
  expect(snapshot.status).toBe('ready')
  const activity = (event: string): ActivityLogEntry => ({ actionable: false, data: {}, event, id: event,
    importance: 'info', ingestedAt: '2026-10-10T10:00:00Z', source: 'journal', timestamp: '2026-10-10T10:00:00Z' })
  await act(async () => events.emit('activity-entry', activity('MissionAccepted')))
  expect(api.getPowerplay).toHaveBeenCalledTimes(1)
  await act(async () => events.emit('journal-history-loaded', null))
  expect(api.getPowerplay).toHaveBeenCalledTimes(2)
  let finish!: (data: PowerplayResponse) => void
  vi.mocked(api.getPowerplay).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  await act(async () => events.emit('activity-entry', activity('PowerplayMerits')))
  const signal = vi.mocked(api.getPowerplay).mock.calls[2]![0]!
  const saved: PowerplayResponse = { ...response, target: { name: 'Target', power: 'Aisling Duval', rank: 4, merits: null },
    targetProgress: { status: 'unknown', remainingMerits: null } }
  vi.mocked(api.savePowerplayTarget).mockResolvedValue(saved)
  await act(async () => { await snapshot.saveTarget(saved.target) })
  expect(signal.aborted).toBe(true)
  await act(async () => finish(response))
  expect(snapshot.data).toEqual(saved)
  expect(snapshot.saving).toBe(false)
  vi.mocked(api.savePowerplayTarget).mockRejectedValueOnce(new Error('Storage unavailable'))
  await act(async () => { await expect(snapshot.saveTarget(null)).rejects.toThrow('Storage unavailable') })
  expect(snapshot.data).toEqual(saved)
  expect(snapshot.saving).toBe(false)
  await act(async () => renderer.unmount())
  vi.mocked(api.getPowerplay).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  renderer = await renderWithAct(<Probe />)
  expect(snapshot.data).toEqual(saved)
  const remountSignal = vi.mocked(api.getPowerplay).mock.calls[3]![0]!
  await act(async () => renderer.unmount())
  expect(remountSignal.aborted).toBe(true)
  await act(async () => finish(response))
  const calls = vi.mocked(api.getPowerplay).mock.calls.length
  await act(async () => events.emit('activity-entry', activity('PowerplayRank')))
  expect(api.getPowerplay).toHaveBeenCalledTimes(calls)
})
