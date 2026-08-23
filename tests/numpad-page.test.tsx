import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vitest'
import type { PhoenixApi } from '../apps/web/src/application/api/phoenix-api.js'
import type { NumpadRouteSession } from '../apps/web/src/application/navigation/numpad-route-session.js'
import type { DevicePreferences } from '../apps/web/src/application/settings/device-preferences.js'
import { NumpadPage } from '../apps/web/src/features/numpad/numpad-page.js'

const routeSession: NumpadRouteSession = {
  acknowledge() {},
  arm() {},
  discard() {},
  isArmed: () => false,
  leave: () => false,
  navigate() {}
}

const settings = {
  numpadCommands: {
    inputAdapter: 'browser' as const,
    presentation: 'tiles' as const,
    alwaysConfirm: false,
    cancelAfterMs: 5000
  }
}

const devicePreferences = (variableNumpadFontSizes = true) => ({
  getSnapshot: () => ({ audioInputId: '', audioOutputId: '', captureNumpad: true, followCopilotNavigation: true, variableNumpadFontSizes }),
  subscribe: () => () => {},
  update: () => {}
}) satisfies DevicePreferences

test('the reconstructed numpad renders the live command navigator', () => {
  const markup = renderToStaticMarkup(<NumpadPage
    api={{} as PhoenixApi}
    devicePreferences={devicePreferences()}
    routeSession={routeSession}
    controller={{
      commands: [],
      settings,
      snapshot: {
        revision: 1,
        generatedAt: '2026-08-17T00:00:00.000Z',
        activationDigit: '0',
        diagnostics: [],
        nodes: [{
          id: 'navigation-fleet',
          parentId: null,
          selector: '1',
          address: '1',
          interactionHint: 'open',
          bindingLabel: null,
          label: 'Fleet',
          description: 'Open the fleet workspace.',
          kind: 'navigation',
          available: true,
          risk: 'routine',
          target: { type: 'navigation', href: '#/fleet' }
        }]
      },
      status: 'ready'
    }}
  />)

  expect(markup).not.toContain('<h1>')
  expect(markup).toContain('--numpad-columns:3')
  expect(markup).toContain('show-background-numbers')
  expect(markup).toContain('variable-font-sizes')
  expect(markup).toContain('data-selector="1"')
  expect(markup).toContain('Press Numpad 0')
  expect(markup).toContain('Fleet')
  expect(markup).not.toContain('Numpad views')
})

test('the numpad command workspace remains available independently of physical key capture', () => {
  const markup = renderToStaticMarkup(<NumpadPage
    api={{} as PhoenixApi}
    devicePreferences={devicePreferences(false)}
    routeSession={routeSession}
    controller={{ commands: [], settings, snapshot: { revision: 1, generatedAt: '2026-08-17T00:00:00.000Z', activationDigit: '0', diagnostics: [], nodes: [] }, status: 'ready' }}
  />)

  expect(markup).toContain('Press Numpad 0')
  expect(markup).not.toContain('responsive-button-font-sizes')
  expect(markup).not.toContain('Enable numpad')
})
