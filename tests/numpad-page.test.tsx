import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vitest'
import type { PhoenixApi } from '../apps/web/src/application/api/phoenix-api.js'
import { NumpadPage } from '../apps/web/src/features/numpad/numpad-page.js'

const settings = {
  macros: { enabled: false, copilotExecution: false, dangerousExecution: false },
  numpadCommands: {
    enabled: true,
    inputAdapter: 'browser' as const,
    presentation: 'tiles' as const,
    alwaysConfirm: false,
    cancelAfterMs: 5000,
    shortcuts: []
  }
}

test('the reconstructed numpad renders the live command navigator', () => {
  const markup = renderToStaticMarkup(<NumpadPage
    api={{} as PhoenixApi}
    view="navigator"
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
  expect(markup).toContain('--numpad-columns:2')
  expect(markup).toContain('Press Numpad 0')
  expect(markup).toContain('Fleet')
  expect(markup).not.toContain('Numpad views')
})

test('the numpad presents an explicit enable action when disabled', () => {
  const markup = renderToStaticMarkup(<NumpadPage
    api={{} as PhoenixApi}
    view="navigator"
    controller={{ commands: [], settings: { ...settings, numpadCommands: { ...settings.numpadCommands, enabled: false } }, snapshot: { revision: 1, generatedAt: '2026-08-17T00:00:00.000Z', activationDigit: '0', diagnostics: [], nodes: [] }, status: 'ready' }}
  />)

  expect(markup).toContain('Numpad module disabled.')
  expect(markup).toContain('Enable numpad')
})
