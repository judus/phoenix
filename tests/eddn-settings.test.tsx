import { act, create } from 'react-test-renderer'
import { beforeAll, expect, test, vi } from 'vitest'
import type { EddnStatus } from '@phoenix/contracts'
import type { PhoenixApi } from '../apps/web/src/application/api/phoenix-api.js'
import { CommunityDataSettings } from '../apps/web/src/features/settings/community-data-settings.js'

beforeAll(() => Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }))
const status: EddnStatus = { enabled: true, mode: 'unavailable', queued: 0, lastSuccessAt: null, losses: [], detail: 'Release review pending.', error: null }

test('community control saves the opt-out and ignores stale poll replies', async () => {
  vi.useFakeTimers()
  let resolvePoll!: (value: EddnStatus) => void
  const api = {
    getEddnStatus: vi.fn().mockResolvedValueOnce(status).mockImplementationOnce(() => new Promise(resolve => { resolvePoll = resolve })),
    saveEddnSettings: vi.fn().mockResolvedValue({ ...status, enabled: false })
  } as unknown as PhoenixApi
  let renderer!: ReturnType<typeof create>
  try {
    await act(async () => { renderer = create(<CommunityDataSettings api={api} />) })
    expect(JSON.stringify(renderer.toJSON())).toContain('Enabled by default')
    await act(async () => { vi.advanceTimersByTime(5000) })
    await act(async () => { renderer.root.findByType('input').props.onChange() })
    expect(api.saveEddnSettings).toHaveBeenCalledWith({ enabled: false })
    await act(async () => resolvePoll(status))
    expect(renderer.root.findByType('input').props.checked).toBe(false)
  } finally {
    if (renderer) await act(async () => renderer.unmount())
    vi.useRealTimers()
  }
})

test('an old API save cannot replace the current device settings view', async () => {
  let resolveSave!: (value: EddnStatus) => void
  const old = { getEddnStatus: vi.fn().mockResolvedValue(status), saveEddnSettings: vi.fn().mockImplementation(() => new Promise(resolve => { resolveSave = resolve })) } as unknown as PhoenixApi
  const current = { getEddnStatus: vi.fn().mockResolvedValue(status) } as unknown as PhoenixApi
  let renderer!: ReturnType<typeof create>
  try {
    await act(async () => { renderer = create(<CommunityDataSettings api={old} />) })
    act(() => { renderer.root.findByType('input').props.onChange() })
    await act(async () => renderer.update(<CommunityDataSettings api={current} />))
    await act(async () => resolveSave({ ...status, enabled: false }))
    expect(renderer.root.findByType('input').props.checked).toBe(true)
  } finally { if (renderer) await act(async () => renderer.unmount()) }
})

test('community settings exposes historical loss totals after a successful send', async () => {
  const api = { getEddnStatus: vi.fn().mockResolvedValue({ ...status,
    lastSuccessAt: '2026-10-04T18:00:00Z', losses: [{ reason: 'capacity', count: 3, lastAt: '2026-10-04T17:00:00Z' }] }) } as unknown as PhoenixApi
  let renderer!: ReturnType<typeof create>
  try {
    await act(async () => { renderer = create(<CommunityDataSettings api={api} />) })
    expect(JSON.stringify(renderer.toJSON())).toContain('3 skipped (capacity limit)')
    expect(renderer.root.findAllByType('span').some(node => node.props.className === 'status status-warning status-wrap')).toBe(true)
  } finally { if (renderer) await act(async () => renderer.unmount()) }
})
