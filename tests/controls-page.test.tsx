import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vitest'
import { createEmptyRuntimeState } from '@phoenix/contracts'
import { controlPickerActionLabel, ControlsPage } from '../apps/web/src/features/controls/controls-page.js'
import type { MacroRuntime } from '../apps/web/src/application/macros/macro-runtime.js'
import { DEFAULT_CONTROL_GRID_LAYOUT } from '../apps/server/src/infrastructure/default-control-grid-layout.js'

test('the controls page renders bound and unbound discovered commands', () => {
  const markup = renderToStaticMarkup(
    <ControlsPage
      category="ship"
      editing={false}
      controller={{
        status: 'ready',
        layout: DEFAULT_CONTROL_GRID_LAYOUT,
        actions: {
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
        }
      }}
      macros={emptyMacroRuntime()}
      runtime={createEmptyRuntimeState()}
      onExecuteAction={() => Promise.reject(new Error('not executed during server rendering'))}
      onEditingChange={() => undefined}
      onSaveLayout={layout => Promise.resolve(layout)}
    />
  )

  expect(markup).toContain('Ship Lights')
  expect(markup).toContain('Unbound')
  expect(markup).toContain('class="page-frame page-fit controls-page"')
  expect(markup).toContain('class="control-deck-empty"')
  expect(markup).toContain('disabled=""')
  expect(markup).toContain('class="page-header page-header-standard"')
  expect(markup).not.toContain('class="page-footer"')
  expect(markup).not.toContain('class="control-toolbar"')
})

test('the control picker disambiguates commands with the same label by context', () => {
  expect(controlPickerActionLabel(action('elite.PrimaryFire', 'PrimaryFire', 'Primary Fire', 'Space', 'combat')))
    .toBe('Primary Fire · Combat · Space')
  expect(controlPickerActionLabel(action('elite.HumanoidPrimaryFireButton', 'HumanoidPrimaryFireButton', 'Primary Fire', null, 'on_foot')))
    .toBe('Primary Fire · On Foot · Unbound')
})

test('unavailable commands remain clickable while editing the control deck', () => {
  const markup = renderToStaticMarkup(
    <ControlsPage
      category="ship"
      editing
      controller={{
        status: 'ready',
        layout: DEFAULT_CONTROL_GRID_LAYOUT,
        actions: {
          backend: { id: 'test', available: true, simulated: false, detail: 'ready' },
          bindingSource: {
            directory: '/bindings', filePath: '/bindings/custom.binds', presetNames: ['Custom'],
            available: true, bindingCount: 1, keyboardBindingCount: 0,
            loadedAt: '2026-08-19T00:00:00.000Z', error: null
          },
          actions: [action('elite.ShipSpotLightToggle', 'ShipSpotLightToggle', 'Ship Lights', null)]
        }
      }}
      macros={emptyMacroRuntime()}
      onExecuteAction={() => Promise.resolve()}
      onEditingChange={() => undefined}
      onSaveLayout={layout => Promise.resolve(layout)}
    />
  )

  expect(markup).toMatch(/<button class="command-tile disabled"[^>]*><strong>Ship Lights<\/strong>/)
  expect(markup).not.toMatch(/<button class="command-tile disabled"[^>]*disabled=""[^>]*><strong>Ship Lights<\/strong>/)
})

function emptyMacroRuntime (): MacroRuntime {
  return {
    abort: async () => undefined,
    cancelRecording: async () => undefined,
    deleteMacro: async () => undefined,
    library: { version: 1, macros: [] },
    play: async () => undefined,
    recordAction: async () => undefined,
    save: async () => undefined,
    setDraft: () => undefined,
    startRecording: async () => undefined,
    stopRecording: async () => undefined
  }
}

function action (
  id: string,
  eliteBinding: string,
  label: string,
  key: string | null,
  category: 'ship' | 'combat' | 'on_foot' = 'ship'
) {
  return {
    available: key !== null,
    binding: key ? { key, modifiers: [], display: key } : null,
    definition: {
      id,
      label,
      description: `${label} command.`,
      category,
      inputMode: 'tap' as const,
      risk: 'routine' as const,
      eliteBinding,
      telemetryKey: null
    },
    unavailableReason: key ? null : `No keyboard binding is configured for ${label}.`
  }
}
