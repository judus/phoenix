import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vitest'
import { createEmptyRuntimeState } from '@phoenix/contracts'
import { ControlsPage } from '../apps/web/src/pages/controls-page.js'

test('the controls page renders bound and unbound discovered commands', () => {
  const markup = renderToStaticMarkup(
    <ControlsPage
      category="ship"
      runtimeState={createEmptyRuntimeState()}
      onExecuteAction={() => Promise.reject(new Error('not executed during server rendering'))}
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

  expect(markup).toContain('Ship Controls')
  expect(markup).toContain('Ship Lights')
  expect(markup).toContain('Unbound')
  expect(markup).toContain('116 keyboard bindings')
  expect(markup).toContain('disabled=""')
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
