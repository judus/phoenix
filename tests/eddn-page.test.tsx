import { act, create } from 'react-test-renderer'
import { beforeAll, expect, test, vi } from 'vitest'
import type { EddnSubmissionDetail, EddnSubmissionLog } from '@phoenix/contracts'
import type { PhoenixApi } from '../apps/web/src/application/api/phoenix-api.js'
import { EddnPage } from '../apps/web/src/features/journal/eddn-page.js'
import { parsePhoenixRoute, phoenixRouteHash } from '../apps/web/src/application/navigation/phoenix-router.js'
import { developerNavigationItems, journalContext } from '../apps/web/src/features/journal/journal-navigation.js'

beforeAll(() => Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }))
const log: EddnSubmissionLog = {
  status: { enabled: true, mode: 'test', queued: 0, lastSuccessAt: null, losses: [], detail: 'Test stream only.', error: null },
  entries: [{ id: 1, observationId: 'one', attempt: 1, startedAt: '2026-10-04T18:00:00Z', completedAt: '2026-10-04T18:00:01Z',
    outcome: 'accepted', httpStatus: 200, retryAt: null, schemaRef: 'https://eddn.edcd.io/schemas/journal/1/test', event: 'FSDJump', system: 'Sol', station: null }]
}

test('EDDN has a directly addressable DEV route and active navigation context', () => {
  const route = { kind: 'developer', view: 'eddn' } as const
  expect(parsePhoenixRoute(phoenixRouteHash(route))).toEqual(route)
  expect(journalContext(route)).toBe('eddn')
  expect(developerNavigationItems.find(item => item.id === 'eddn')?.route).toEqual(route)
})

test('shows acceptance and payload, polls summaries without refetching unchanged payload', async () => {
  vi.useFakeTimers()
  const api = { getEddnSubmissions: vi.fn().mockResolvedValue(log), getEddnSubmission: vi.fn().mockResolvedValue({ payload: { message: { event: 'FSDJump' } } }) } as unknown as PhoenixApi
  let renderer!: ReturnType<typeof create>
  try {
    await act(async () => { renderer = create(<EddnPage api={api} />) })
    expect(JSON.stringify(renderer.toJSON())).toContain('Accepted · HTTP 200')
    expect(renderer.root.findByType('pre').children.join('')).toContain('FSDJump')
    await act(async () => { vi.advanceTimersByTime(5000) })
    expect(api.getEddnSubmissions).toHaveBeenCalledTimes(2)
    expect(api.getEddnSubmission).toHaveBeenCalledTimes(1)
    await act(async () => renderer.unmount())
    await act(async () => { vi.advanceTimersByTime(5000) })
    expect(api.getEddnSubmissions).toHaveBeenCalledTimes(2)
  } finally { vi.useRealTimers() }
})

test('changing selection ignores a late payload and presents the selected attempt', async () => {
  let resolveOld!: (value: EddnSubmissionDetail) => void
  const api = {
    getEddnSubmissions: vi.fn().mockResolvedValue({ ...log, entries: [log.entries[0], { ...log.entries[0], id: 2, event: 'Scan', outcome: 'rejected', httpStatus: 400 }] }),
    getEddnSubmission: vi.fn().mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve })).mockResolvedValue({ payload: { event: 'Scan' } })
  } as unknown as PhoenixApi
  let renderer!: ReturnType<typeof create>
  try {
    await act(async () => { renderer = create(<EddnPage api={api} />) })
    await act(async () => renderer.root.findAllByType('button')[1].props.onClick())
    await act(async () => resolveOld({ payload: { event: 'FSDJump' } }))
    expect(renderer.root.findByType('pre').children.join('')).toContain('Scan')
    expect(renderer.root.findByType('pre').children.join('')).not.toContain('FSDJump')
    expect(JSON.stringify(renderer.toJSON())).toContain('Rejected · HTTP 400')
  } finally { if (renderer) await act(async () => renderer.unmount()) }
})

test('empty and failed log reads are visible and recover on the next poll', async () => {
  vi.useFakeTimers()
  const api = { getEddnSubmissions: vi.fn().mockRejectedValueOnce(new Error('Log unavailable')).mockResolvedValue({ ...log, entries: [] }) } as unknown as PhoenixApi
  let renderer!: ReturnType<typeof create>
  try {
    await act(async () => { renderer = create(<EddnPage api={api} />) })
    expect(JSON.stringify(renderer.toJSON())).toContain('Log unavailable')
    await act(async () => { vi.advanceTimersByTime(5000) })
    expect(JSON.stringify(renderer.toJSON())).toContain('No submission attempts yet')
    expect(JSON.stringify(renderer.toJSON())).not.toContain('Log unavailable')
  } finally {
    if (renderer) await act(async () => renderer.unmount())
    vi.useRealTimers()
  }
})

test('delivery losses stay visible alongside accepted attempts with no current error', async () => {
  const api = { getEddnSubmissions: vi.fn().mockResolvedValue({ ...log, status: { ...log.status,
    losses: [{ reason: 'expired', count: 7, lastAt: log.entries[0].startedAt },
      { reason: 'cleared', count: 2, lastAt: log.entries[0].startedAt }] } }),
    getEddnSubmission: vi.fn().mockResolvedValue({ payload: {} }) } as unknown as PhoenixApi
  let renderer!: ReturnType<typeof create>
  try {
    await act(async () => { renderer = create(<EddnPage api={api} />) })
    const markup = JSON.stringify(renderer.toJSON())
    expect(markup).toContain('7 expired')
    expect(markup).toContain('2 cleared by preference/build policy')
    expect(markup).toContain('Accepted · HTTP 200')
  } finally { if (renderer) await act(async () => renderer.unmount()) }
})
