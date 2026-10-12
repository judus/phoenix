import { notificationMarkup, notificationText } from './support/notifications.js'
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

test('queue and recent results are separate visible tables with article links preserving search', async () => {
  const client = api()
  client.getGalnetBackground.mockResolvedValue({ ...initial, pending: 1, jobs: ['pending', 'running', 'failed', 'succeeded'].map(state => ({
    id: state, articleId: state, articleRevisionId: 'revision', title: `${state} article`, reason: 'catch-up' as const,
    state: state as 'pending' | 'running' | 'failed' | 'succeeded', queuedAt: initial.installedAt,
    startedAt: state === 'pending' ? null : initial.installedAt, finishedAt: state === 'failed' || state === 'succeeded' ? initial.installedAt : null,
    error: state === 'failed' ? 'Synthetic failure' : null
  })) })
  const renderer = await renderWithAct(<GalnetBackgroundPanel api={client} readingRoute={{ kind: 'information', section: 'comms', view: 'galnet', search: 'ship' }} />)
  try {
    const queue = renderer.root.findByProps({ label: 'Analysis queue' })
    const history = renderer.root.findByProps({ label: 'Recent analysis results' })
    expect(queue.findByType('tbody').findAllByType('tr')).toHaveLength(2)
    expect(history.findByType('tbody').findAllByType('tr')).toHaveLength(3)
    expect(JSON.stringify(renderer.toJSON())).toContain('Synthetic failure')
    const diagnostic = history.findByType('details')
    expect(diagnostic.props.open).toBeUndefined()
    expect(diagnostic.parent!.props).toMatchObject({ colSpan: 3, className: 'wrap' })
    expect(queue.findAllByType('a')[0]!.props.href).toBe('#/comms/galnet?article=pending&search=ship')
    expect(client.catchUpGalnet).not.toHaveBeenCalled()
  } finally { await act(async () => renderer.unmount()) }
})

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

test('retained source advisories are orange while independent action failures remain red', async () => {
  const client = api()
  client.getGalnetBackground.mockResolvedValue({ ...initial, sourceError: 'The queue is full.' })
  client.catchUpGalnet.mockRejectedValue(new Error('Storage failed.'))
  const renderer = await renderWithAct(<GalnetBackgroundPanel api={client} />)
  try {
    expect(notificationText()).toBe('The queue is full.')
    expect(notificationMarkup()).toContain('toast warning notification')
    expect(notificationMarkup()).not.toContain('role="alert"')
    await act(async () => renderer.root.findByType('button').props.onClick())
    expect(notificationText()).toContain('The queue is full.')
    expect(notificationText()).toContain('Storage failed.')
    expect(notificationMarkup()).toContain('toast danger notification')
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
  expect(notificationText()).toContain('Synthetic storage failure')
  expect(client.catchUpGalnet).toHaveBeenCalledTimes(1)
  const signal = client.getGalnetBackground.mock.calls[0]![0]
  await act(async () => renderer.unmount())
  expect(signal?.aborted).toBe(true)
})
