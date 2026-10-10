import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, expect, test, vi } from 'vitest'
import { Navigation } from '@phoenix/ui'
import { act } from 'react-test-renderer'
import { renderWithAct } from './support/render-with-act.js'
import { PhoenixApplicationShell } from '../apps/web/src/components/shell/phoenix-application-shell.js'

afterEach(() => vi.unstubAllGlobals())

test('workspace controls occupy the top rail in order, without a bottom bar', () => {
  const markup = renderToStaticMarkup(<PhoenixApplicationShell
    activeDesktop="info" showNumpadButton showDeveloper
    controls={null} copilot={null} information={null} journal={null} settings={null} telemetry={null}
    informationRoute={{ kind: 'information', section: 'commander', view: 'dashboard' }}
    onNavigateRoute={() => undefined} onNavigateWorkspace={() => undefined}
  />)
  expect([...markup.matchAll(/<abbr[^>]*>([^<]+)<\/abbr>/gu)].map(match => match[1]))
    .toEqual(['011', 'CTR', 'INF', 'LOG', 'CPT', 'STG', 'DEV', 'F11', 'F13'])
  expect(markup).not.toContain('workspace-navigation')
  expect(markup).toContain('aria-label="Workspaces"')
})

test('hiding 011 removes its rail button even when Numpy is active', () => {
  const markup = renderToStaticMarkup(<PhoenixApplicationShell
    activeDesktop="telemetry" showNumpadButton={false}
    controls={null} copilot={null} information={null} journal={null} settings={null}
    telemetry={<p>Numpy is active</p>}
    informationRoute={{ kind: 'information', section: 'commander', view: 'dashboard' }}
    onNavigateRoute={() => undefined} onNavigateWorkspace={() => undefined}
  />)
  expect(markup).not.toContain('href="#/numpad"')
})

test.each([
  ['Mozilla/5.0 Chrome/130.0 Safari/537.36', true],
  ['Mozilla/5.0 (Linux; Android 15; Tablet) Chrome/130.0 Safari/537.36', true],
  ['Mozilla/5.0 (Linux; Android 15; wv) Chrome/130.0 Safari/537.36 PhoenixAndroid/0.1.5-dev', false]
])('the application rail shows F11 only outside the Android shell: %s', (userAgent, visible) => {
  vi.stubGlobal('navigator', { userAgent })
  const markup = renderToStaticMarkup(<PhoenixApplicationShell
    activeDesktop="info"
    controls={null}
    copilot={null}
    information={null}
    journal={null}
    settings={null}
    telemetry={null}
    informationRoute={{ kind: 'information', section: 'commander', view: 'dashboard' }}
    onNavigateRoute={() => undefined}
    onNavigateWorkspace={() => undefined}
  />)
  expect(markup.includes('F11')).toBe(visible)
  expect(markup.includes('aria-label="Reload PHOENIX"')).toBe(!visible)
  expect(markup.includes('RLD')).toBe(!visible)
  expect(markup).toContain('F13')
  expect(markup).toContain('STG')
})

test('Android rail reload action reloads the current document without workspace navigation', async () => {
  vi.stubGlobal('navigator', { userAgent: 'PhoenixAndroid/0.1.7' })
  const reload = vi.fn()
  vi.stubGlobal('location', { reload })
  const onNavigateRoute = vi.fn()
  const onNavigateWorkspace = vi.fn()
  const renderer = await renderWithAct(<PhoenixApplicationShell
    activeDesktop="info" controls={null} copilot={null} information={null} journal={null}
    settings={null} telemetry={null}
    informationRoute={{ kind: 'information', section: 'commander', view: 'dashboard' }}
    onNavigateRoute={onNavigateRoute} onNavigateWorkspace={onNavigateWorkspace}
  />)
  try {
    await act(async () => renderer.root.findByProps({ 'aria-label': 'Reload PHOENIX' }).props.onClick())
    expect(reload).toHaveBeenCalledExactlyOnceWith()
    expect(onNavigateRoute).not.toHaveBeenCalled()
    expect(onNavigateWorkspace).not.toHaveBeenCalled()
  } finally { await act(async () => renderer.unmount()) }
})

test('fullscreen is exposed as a synchronized navigation action, not a route', () => {
  const markup = renderToStaticMarkup(
    <Navigation
      current="info"
      items={[{
        id: 'fullscreen',
        kind: 'action',
        label: 'Exit fullscreen',
        shortLabel: '⛶',
        pressed: true
      }]}
      label="Utilities"
      variant="compact"
    />
  )

  expect(markup).toContain('<button type="button" class="nav-item active"')
  expect(markup).toContain('aria-label="Exit fullscreen"')
  expect(markup).toContain('aria-pressed="true"')
  expect(markup).not.toContain('href=')
})

test('focus view is exposed as a synchronized F13 action', () => {
  const markup = renderToStaticMarkup(
    <Navigation
      current="info"
      items={[{
        id: 'focus',
        kind: 'action',
        label: 'Exit focus view',
        shortLabel: 'F13',
        pressed: true
      }]}
      label="Utilities"
      variant="compact"
    />
  )

  expect(markup).toContain('aria-label="Exit focus view"')
  expect(markup).toContain('aria-pressed="true"')
  expect(markup).toContain('F13')
  expect(markup).not.toContain('href=')
})
