import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { act, create } from 'react-test-renderer'
import { afterEach, beforeAll, expect, test, vi } from 'vitest'
import { createEmptyRuntimeState } from '@phoenix/contracts'
import { controlPickerActionLabel, ControlsPage, resizeDeck } from '../apps/web/src/features/controls/controls-page.js'
import type { MacroRuntime } from '../apps/web/src/application/macros/macro-runtime.js'
import { DEFAULT_CONTROL_DECK_CONFIGURATION } from '../apps/server/src/infrastructure/default-control-deck-configuration.js'

beforeAll(() => Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }))
afterEach(() => vi.useRealTimers())

test('the controls page renders bound and unbound discovered commands', () => {
  const markup = renderToStaticMarkup(
    <ControlsPage
      category="ship"
      editing={false}
      controller={{
        status: 'ready',
        configuration: DEFAULT_CONTROL_DECK_CONFIGURATION,
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
      onSaveConfiguration={configuration => Promise.resolve(configuration)}
    />
  )

  expect(markup).toContain('Ship Lights')
  expect(markup).toContain('Unbound')
  expect(markup).toContain('class="page-frame page-fit controls-page theme-phoenix"')
  expect(markup).toContain('class="control-deck-empty"')
  expect(markup).toContain('disabled=""')
  expect(markup).not.toContain('class="page-header')
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
        configuration: DEFAULT_CONTROL_DECK_CONFIGURATION,
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
      onSaveConfiguration={configuration => Promise.resolve(configuration)}
    />
  )

  const shipButton = markup.match(/<button aria-label="Ship Lights, Unbound"[^>]*>/)?.[0]
  expect(shipButton).toContain('unavailable')
  expect(shipButton).not.toContain('disabled=""')
  expect(markup).toMatch(/<strong class="label"[^>]*>Ship Lights<\/strong>/)
  expect(markup).toContain('aria-label="Deck settings"')
  expect(markup).not.toContain('aria-label="Deck name"')
  expect(markup).toContain('aria-label="Deck columns"')
  expect(markup).toContain('aria-label="Deck rows"')
  expect(markup).toContain('aria-label="Deck theme"')
  expect(markup).toContain('aria-label="Deck layout"')
  expect(markup).toContain('<option value="phoenix.ship" selected="">Phoenix Ship</option>')
  expect(markup).toContain('<option value="phoenix" selected="">Phoenix</option>')
  expect(markup).toMatch(/<strong class="label"[^>]*>Cancel<\/strong>/)
  expect(markup).toMatch(/<strong class="label"[^>]*>Save<\/strong>/)
  expect(markup).not.toContain('Subdeck')
  expect(markup).not.toContain('Delete deck')
})

test('resizing a PHOENIX deck removes only cells that no longer fit', () => {
  const deck = DEFAULT_CONTROL_DECK_CONFIGURATION.decks.find(candidate => candidate.context === 'phoenix:ship')!
  const resized = resizeDeck(deck, 4, 4)

  expect(resized.layout).toEqual({ kind: 'grid', columns: 4, rows: 4 })
  expect(resized.elements.every(element => element.placement.row + element.placement.rowSpan - 1 <= 4)).toBe(true)
  expect(resized.elements.every(element => element.placement.column + element.placement.columnSpan - 1 <= 4)).toBe(true)
})

test('control-deck tiles reserve long presses for cockpit hold gestures', () => {
  const stylesheet = readFileSync(new URL('../packages/ui/src/styles/pages/controls.css', import.meta.url), 'utf8')

  expect(stylesheet).toMatch(/\.control-deck-slot > \.tile\.btn \{[\s\S]*?touch-action: none;/)
  expect(stylesheet).toMatch(/\.control-deck-slot > \.tile\.btn \{[\s\S]*?user-select: none;/)
  expect(stylesheet).toMatch(/\.control-deck-slot > \.tile\.btn \{[\s\S]*?-webkit-touch-callout: none;/)
  expect(stylesheet).toMatch(/\.control-deck-settings \{[\s\S]*?grid-template-columns:/)
  expect(stylesheet).toMatch(/\.theme-orange \{ --control-deck-accent: #ff8a4c;/)
})

test('PHOENIX uses the shared hold-to-arm interaction before executing a safety button', () => {
  vi.useFakeTimers()
  const execute = vi.fn(() => Promise.resolve())
  const actionCandidate = action('elite.EjectAllCargo', 'EjectAllCargo', 'Eject all cargo', 'X')
  const eject = { ...actionCandidate, definition: { ...actionCandidate.definition, risk: 'dangerous' as const } }
  let renderer!: ReturnType<typeof create>
  act(() => { renderer = create(<ControlsPage
    category="ship"
    editing={false}
    controller={{
      status: 'ready',
      configuration: DEFAULT_CONTROL_DECK_CONFIGURATION,
      actions: {
        backend: { id: 'test', available: true, simulated: false, detail: 'ready' },
        bindingSource: {
          directory: '/bindings', filePath: '/bindings/custom.binds', presetNames: ['Custom'],
          available: true, bindingCount: 1, keyboardBindingCount: 1,
          loadedAt: '2026-08-21T00:00:00.000Z', error: null
        },
        actions: [eject]
      }
    }}
    macros={emptyMacroRuntime()}
    onExecuteAction={execute}
    onEditingChange={() => undefined}
    onSaveConfiguration={configuration => Promise.resolve(configuration)}
  />) })
  const button = renderer.root.findAllByType('button').find(candidate => candidate.findAllByType('strong').some(label => label.children.includes('Eject all cargo')))!

  act(() => button.props.onPointerDown({ pointerId: 1, currentTarget: { setPointerCapture: vi.fn() } }))
  act(() => vi.advanceTimersByTime(650))
  expect(button.findAllByType('small').some(meta => meta.children.includes('tap'))).toBe(true)
  act(() => button.props.onPointerUp({ pointerId: 1 }))
  act(() => vi.advanceTimersByTime(0))
  act(() => button.props.onClick({ detail: 1 }))

  expect(execute).toHaveBeenCalledOnce()
  expect(execute).toHaveBeenCalledWith('elite.EjectAllCargo', 'tap', undefined)
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
