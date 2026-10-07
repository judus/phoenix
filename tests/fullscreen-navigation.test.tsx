import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, expect, test, vi } from 'vitest'
import { Navigation } from '@phoenix/ui'
import { PhoenixApplicationShell } from '../apps/web/src/components/shell/phoenix-application-shell.js'

afterEach(() => vi.unstubAllGlobals())

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
    macros={null}
    settings={null}
    telemetry={null}
    informationRoute={{ kind: 'information', section: 'commander', view: 'dashboard' }}
    onNavigateRoute={() => undefined}
    onNavigateWorkspace={() => undefined}
  />)
  expect(markup.includes('F11')).toBe(visible)
  expect(markup).toContain('F13')
  expect(markup).toContain('STG')
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
