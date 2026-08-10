import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vitest'
import { createEmptyRuntimeState } from '@phoenix/contracts'
import { ControlsPage } from '../apps/web/src/pages/controls-page.js'
import { DEFAULT_CONTROL_GRID_LAYOUT } from '../apps/server/src/infrastructure/default-control-grid-layout.js'

test('the controls page renders bound and unbound discovered commands', () => {
  const markup = renderToStaticMarkup(
    <ControlsPage
      category="ship"
      controlLayout={DEFAULT_CONTROL_GRID_LAYOUT}
      runtimeState={createEmptyRuntimeState()}
      onExecuteAction={() => Promise.reject(new Error('not executed during server rendering'))}
      onSaveLayout={layout => Promise.resolve(layout)}
      actionCatalog={{
        backend: {
          id: 'linux-xdotool',
          available: true,
          simulated: false,
          detail: 'xdotool ready'
        },
        bindingSource: {
          directory: '/game/Bindings',
          filePath: '/game/Bindings/Custom.4.2.binds',
          presetNames: ['Custom'],
          available: true,
          bindingCount: 352,
          keyboardBindingCount: 116,
          loadedAt: '2026-08-10T14:00:00.000Z',
          error: null
        },
        actions: [
          action('elite.ShipSpotLightToggle', 'ShipSpotLightToggle', 'Ship Lights', 'L'),
          action('elite.UseBoostJuice', 'UseBoostJuice', 'Boost', null)
        ]
      }}
    />
  )

  expect(markup).toContain('Ship Lights')
  expect(markup).toContain('Unbound')
  expect(markup).toContain('title="Edit layout"')
  expect(markup).toContain('class="page controls-page"')
  expect(markup).toContain('class="control-grid__empty"')
  expect(markup).toContain('disabled=""')
  expect(markup).not.toContain('class="page-header"')
  expect(markup).not.toContain('class="page-footer"')
  expect(markup).not.toContain('class="control-toolbar"')
})

function action (
  id: string,
  eliteBinding: string,
  label: string,
  key: string | null
) {
  return {
    available: key !== null,
    binding: key ? { key, modifiers: [], display: key } : null,
    definition: {
      id,
      label,
      description: `${label} command.`,
      category: 'ship' as const,
      inputMode: 'tap' as const,
      risk: 'routine' as const,
      eliteBinding,
      telemetryKey: null
    },
    unavailableReason: key ? null : `No keyboard binding is configured for ${label}.`
  }
}
