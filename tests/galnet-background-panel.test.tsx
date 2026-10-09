import { act } from 'react-test-renderer'
import { beforeAll, expect, test, vi } from 'vitest'
import type { GalnetBackgroundStatus } from '@phoenix/contracts'
import { GalnetBackgroundPanel } from '../apps/web/src/features/comms/galnet-background-panel.js'
import { GalnetAnalysisSettings } from '../apps/web/src/features/settings/galnet-analysis-settings.js'
import { renderWithAct } from './support/render-with-act.js'

beforeAll(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }) })
const initial: GalnetBackgroundStatus = { enabled: false, dailyLimit: 10, configured: true,
  installedAt: '2026-10-08T00:00:00Z', lastCheckedAt: null, sourceError: null, requestsToday: 0,
  pending: 0, jobs: [], backlog: [{ articleId: 'old-article', title: 'Old coverage', publishedAt: '2026-09-01T00:00:00Z' }] }

function api() {
  return { getGalnetBackground: vi.fn(async (_signal?: AbortSignal) => initial), saveGalnetBackground: vi.fn(async () => ({ ...initial, enabled: true })),
    catchUpGalnet: vi.fn(async () => ({ ...initial, pending: 1, backlog: [] })) }
}

test('opening work panel is read-only; catch-up needs an explicit press and shows API-credit disclosure', async () => {
  const client = api()
  const renderer = await renderWithAct(<GalnetBackgroundPanel api={client} />)
  try {
    expect(client.catchUpGalnet).not.toHaveBeenCalled()
    expect(client.saveGalnetBackground).not.toHaveBeenCalled()
    expect(JSON.stringify(renderer.toJSON())).toContain('uses API credit')
    await act(async () => { renderer.root.findByType('button').props.onClick() })
    expect(client.catchUpGalnet).toHaveBeenCalledWith(['old-article'], expect.any(AbortSignal))
    expect(renderer.root.findByType('button').props.disabled).toBe(true)
  } finally { await act(async () => renderer.unmount()) }
})

test('background setting explicitly enables the worker without invoking catch-up', async () => {
  const client = api()
  const renderer = await renderWithAct(<GalnetAnalysisSettings api={client} />)
  try {
    const toggle = renderer.root.findByType('input')
    expect(toggle.props.checked).toBe(false)
    await act(async () => { toggle.props.onChange() })
    expect(client.saveGalnetBackground).toHaveBeenCalledWith({ enabled: true, dailyLimit: 10 }, expect.any(AbortSignal))
    expect(renderer.root.findByType('input').props.checked).toBe(true)
    expect(client.catchUpGalnet).not.toHaveBeenCalled()
  } finally { await act(async () => renderer.unmount()) }
})

test('failed catch-up keeps the queue visible, does not retry and aborts polling on unmount', async () => {
  const client = api()
  client.catchUpGalnet.mockRejectedValueOnce(new Error('Synthetic storage failure'))
  const renderer = await renderWithAct(<GalnetBackgroundPanel api={client} />)
  await act(async () => { renderer.root.findByType('button').props.onClick() })
  expect(JSON.stringify(renderer.toJSON())).toContain('Synthetic storage failure')
  expect(client.catchUpGalnet).toHaveBeenCalledTimes(1)
  const signal = client.getGalnetBackground.mock.calls[0]![0]
  await act(async () => renderer.unmount())
  expect(signal?.aborted).toBe(true)
})
