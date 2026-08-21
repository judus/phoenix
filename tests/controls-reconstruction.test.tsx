import { renderToStaticMarkup } from 'react-dom/server'
import { createEmptyRuntimeState } from '@phoenix/contracts'
import { expect, test } from 'vitest'
import { DEFAULT_CONTROL_DECK_CONFIGURATION } from '../apps/server/src/infrastructure/default-control-deck-configuration.js'
import { ControlsPage } from '../apps/web/src/features/controls/controls-page.js'
import type { MacroRuntime } from '../apps/web/src/application/macros/macro-runtime.js'

test('reconstructed controls render the persisted grid with shared command tiles', () => {
  const markup = renderToStaticMarkup(<ControlsPage
    category="ship"
    editing={false}
    controller={{
      actions: {
        backend: { id: 'test', available: true, simulated: false, detail: 'ready' },
        bindingSource: {
          directory: '/bindings', filePath: '/bindings/custom.binds', presetNames: ['Custom'],
          available: true, bindingCount: 1, keyboardBindingCount: 1,
          loadedAt: '2026-08-17T00:00:00.000Z', error: null
        },
        actions: [{
          available: true,
          binding: { key: 'L', modifiers: [], display: 'L' },
          definition: {
            id: 'elite.ShipSpotLightToggle', eliteBinding: 'ShipSpotLightToggle', label: 'Ship lights',
            description: 'Toggle ship lights.', category: 'ship', inputMode: 'tap', risk: 'routine', telemetryKey: 'lightsOn'
          },
          unavailableReason: null
        }]
      },
      configuration: DEFAULT_CONTROL_DECK_CONFIGURATION,
      status: 'ready'
    }}
    macros={{ library: { version: 1, macros: [] } } as unknown as MacroRuntime}
    runtime={createEmptyRuntimeState()}
    onExecuteAction={() => Promise.resolve()}
    onEditingChange={() => undefined}
    onSaveConfiguration={configuration => Promise.resolve(configuration)}
  />)

  expect(markup).toContain('Ship lights')
  expect(markup).toContain('class="command-tile"')
  expect(markup).toContain('aria-label="Ship command grid"')
  expect(markup).toContain('grid-template-columns:repeat(8, minmax(0, 1fr))')
})
