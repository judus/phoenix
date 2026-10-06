import { renderWithAct } from './support/render-with-act.js'
import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { act, create } from 'react-test-renderer'
import { afterEach, beforeAll, expect, test, vi } from 'vitest'
import { createEmptyRuntimeState } from '@phoenix/contracts'
import { ControlDeckCommandCatalogueSchema } from 'control-deck/core'
import { applyControlDeckTheme, controlPickerActionLabel, ControlsPage, resizeDeck } from '../apps/web/src/features/controls/controls-page.js'
import type { MacroRuntime } from '../apps/web/src/application/macros/macro-runtime.js'
import { DEFAULT_CONTROL_DECK_CONFIGURATION } from '../apps/server/src/infrastructure/default-control-deck-configuration.js'
import { ControlSurface } from '../apps/web/src/features/controls/control-surface.js'

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
      variableFontSizes
    />
  )

  expect(markup).toContain('Ship Lights')
  expect(markup).toContain('Unbound')
  expect(markup).toContain('class="page-frame page-fit controls-page theme-phoenix"')
  expect(markup).toContain('class="tile btn variable-font-sizes"')
  expect(markup).toContain('aria-label="Ship command grid"')
  expect(markup).toContain('grid-template-columns:repeat(8, minmax(0, 1fr))')
  expect(markup).toContain('class="control-deck-empty"')
  expect(markup).toContain('disabled=""')
  expect(markup).not.toContain('class="page-header')
  expect(markup).not.toContain('class="page-footer"')
  expect(markup).not.toContain('class="control-toolbar"')
})

test('a button label override replaces the command catalogue label', () => {
  const configuration = {
    ...DEFAULT_CONTROL_DECK_CONFIGURATION,
    decks: DEFAULT_CONTROL_DECK_CONFIGURATION.decks.map(deck => deck.context !== 'phoenix:ship'
      ? deck
      : {
          ...deck,
          elements: deck.elements.map(element => element.kind !== 'command' || element.target.commandId !== 'command.elite.ShipSpotLightToggle'
            ? element
            : { ...element, appearance: { ...element.appearance, label: 'Floodlights' } })
        })
  }
  const markup = renderToStaticMarkup(
    <ControlsPage
      category="ship"
      editing={false}
      controller={{
        status: 'ready',
        configuration,
        actions: {
          backend: { id: 'test', available: true, simulated: false, detail: 'ready' },
          bindingSource: {
            directory: '/bindings', filePath: '/bindings/custom.binds', presetNames: ['Custom'],
            available: true, bindingCount: 1, keyboardBindingCount: 1,
            loadedAt: '2026-08-19T00:00:00.000Z', error: null
          },
          actions: [action('elite.ShipSpotLightToggle', 'ShipSpotLightToggle', 'Ship Lights', 'L')]
        }
      }}
      macros={emptyMacroRuntime()}
      onExecuteAction={() => Promise.resolve()}
      onEditingChange={() => undefined}
      onSaveConfiguration={saved => Promise.resolve(saved)}
      variableFontSizes={false}
    />
  )

  expect(markup).toMatch(/<strong class="label"[^>]*>Floodlights<\/strong>/)
  expect(markup).not.toMatch(/<strong class="label"[^>]*>Ship Lights<\/strong>/)
  expect(markup).not.toContain('variable-font-sizes')
})

test('a button color override is applied to the command tile', () => {
  const configuration = {
    ...DEFAULT_CONTROL_DECK_CONFIGURATION,
    decks: DEFAULT_CONTROL_DECK_CONFIGURATION.decks.map(deck => deck.context !== 'phoenix:ship'
      ? deck
      : {
          ...deck,
          elements: deck.elements.map(element => element.kind !== 'command' || element.target.commandId !== 'command.elite.ShipSpotLightToggle'
            ? element
            : {
                ...element,
                appearance: {
                  ...element.appearance,
                  foregroundColor: '#ff6258' as const,
                  backgroundColor: '#3a1717' as const
                }
              })
        })
  }
  const markup = renderToStaticMarkup(
    <ControlsPage
      category="ship"
      editing={false}
      controller={{
        status: 'ready',
        configuration,
        actions: {
          backend: { id: 'test', available: true, simulated: false, detail: 'ready' },
          bindingSource: {
            directory: '/bindings', filePath: '/bindings/custom.binds', presetNames: ['Custom'],
            available: true, bindingCount: 1, keyboardBindingCount: 1,
            loadedAt: '2026-08-19T00:00:00.000Z', error: null
          },
          actions: [action('elite.ShipSpotLightToggle', 'ShipSpotLightToggle', 'Ship Lights', 'L')]
        }
      }}
      macros={emptyMacroRuntime()}
      onExecuteAction={() => Promise.resolve()}
      onEditingChange={() => undefined}
      onSaveConfiguration={saved => Promise.resolve(saved)}
      variableFontSizes={false}
    />
  )

  const shipButton = markup.match(/<button aria-label="Ship Lights, L"[^>]*>/)?.[0]
  expect(shipButton).toContain('--command-border:var(--command-danger-border)')
  expect(shipButton).toContain('--command-background:var(--command-danger-background)')
  expect(shipButton).not.toContain('--command-meta:')
  expect(shipButton).not.toContain('--command-text:')
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
      variableFontSizes
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
  expect(markup).not.toMatch(/<strong class="label"[^>]*>Cancel<\/strong>/)
  expect(markup).toContain('aria-label="Save and finish editing"')
  expect(markup).toMatch(/class="btn btn-primary btn-icon btn-icon-square control-deck-save"[^>]*aria-label="Save and finish editing"/)
  expect(markup).not.toContain('Subdeck')
  expect(markup).not.toContain('Delete deck')
})

test('resizing a PHOENIX deck removes only cells that no longer fit', () => {
  const source = DEFAULT_CONTROL_DECK_CONFIGURATION.decks.find(candidate => candidate.context === 'phoenix:ship')!
  const element = source.elements[0]!
  const placements = [
    { id: 'inside', column: 1, row: 1, columnSpan: 1, rowSpan: 1 },
    { id: 'at-edge', column: 3, row: 3, columnSpan: 2, rowSpan: 2 },
    { id: 'outside-column', column: 5, row: 1, columnSpan: 1, rowSpan: 1 },
    { id: 'outside-row', column: 1, row: 5, columnSpan: 1, rowSpan: 1 },
    { id: 'crosses-column', column: 4, row: 1, columnSpan: 2, rowSpan: 1 },
    { id: 'crosses-row', column: 1, row: 4, columnSpan: 1, rowSpan: 2 }
  ]
  const deck = { ...source, elements: placements.map(({ id, ...placement }) => ({
    ...element, id, placement: { kind: 'grid' as const, ...placement }
  })) }
  const original = structuredClone(deck)
  const resized = resizeDeck(deck, 4, 4)

  expect(resized.layout).toEqual({ kind: 'grid', columns: 4, rows: 4 })
  expect(resized.elements).toEqual(original.elements.slice(0, 2))
  expect(deck).toEqual(original)
  expect(resizeDeck(deck, 6, 6).elements).toEqual(original.elements)
})

test('selecting the Phoenix theme clears legacy group and deck colors', () => {
  const sourceDeck = DEFAULT_CONTROL_DECK_CONFIGURATION.decks.find(candidate => candidate.context === 'phoenix:combat')!
  const sourceGroup = DEFAULT_CONTROL_DECK_CONFIGURATION.groups!.find(candidate => candidate.id === sourceDeck.groupId)!
  const deck = { ...sourceDeck, appearance: { colorScheme: 'blue' as const } }
  const group = { ...sourceGroup, appearance: { colorScheme: 'orange' as const } }
  const configuration = {
    ...DEFAULT_CONTROL_DECK_CONFIGURATION,
    groups: DEFAULT_CONTROL_DECK_CONFIGURATION.groups!.map(candidate => candidate.id === group.id ? group : candidate),
    decks: DEFAULT_CONTROL_DECK_CONFIGURATION.decks.map(candidate => candidate.id === deck.id ? deck : candidate)
  }

  const updated = applyControlDeckTheme(configuration, deck, group, 'phoenix')

  expect(updated.groups?.find(candidate => candidate.id === group.id)?.appearance).toBeUndefined()
  expect(updated.decks.find(candidate => candidate.id === deck.id)?.appearance).toBeUndefined()
})

test('selecting a deck theme stores it on the deck and clears a legacy group theme', () => {
  const sourceDeck = DEFAULT_CONTROL_DECK_CONFIGURATION.decks.find(candidate => candidate.context === 'phoenix:combat')!
  const sourceGroup = DEFAULT_CONTROL_DECK_CONFIGURATION.groups!.find(candidate => candidate.id === sourceDeck.groupId)!
  const group = { ...sourceGroup, appearance: { colorScheme: 'orange' as const } }
  const configuration = {
    ...DEFAULT_CONTROL_DECK_CONFIGURATION,
    groups: DEFAULT_CONTROL_DECK_CONFIGURATION.groups!.map(candidate => candidate.id === group.id ? group : candidate)
  }

  const updated = applyControlDeckTheme(configuration, sourceDeck, group, 'red')

  expect(updated.groups?.find(candidate => candidate.id === group.id)?.appearance).toBeUndefined()
  expect(updated.decks.find(candidate => candidate.id === sourceDeck.id)?.appearance).toEqual({ colorScheme: 'red' })
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
    variableFontSizes
  />) })
  const button = renderer.root.findAllByType('button').find(candidate => candidate.findAllByType('strong').some(label => label.children.includes('Eject all cargo')))!
  expect(button.props['data-deskplane-swipe-through']).toBeUndefined()

  act(() => button.props.onPointerDown({ pointerId: 1, currentTarget: { setPointerCapture: vi.fn() } }))
  act(() => { vi.advanceTimersByTime(650) })
  expect(button.findAllByType('small').some(meta => meta.children.includes('tap'))).toBe(true)
  expect(button.props['data-deskplane-swipe-through']).toBeUndefined()
  act(() => button.props.onPointerUp({ pointerId: 1 }))
  act(() => { vi.advanceTimersByTime(0) })
  act(() => button.props.onClick({ detail: 1 }))

  expect(execute).toHaveBeenCalledOnce()
  expect(execute).toHaveBeenCalledWith('elite.EjectAllCargo', 'tap', undefined)
})

test('Quick access navigation executes locally and missing targets remain editable', async () => {
  const onExecuteNavigation = vi.fn(async () => {})
  const onExecuteAction = vi.fn(async () => {})
  const quick = DEFAULT_CONTROL_DECK_CONFIGURATION.decks.find(deck => deck.context === 'phoenix:quick')!
  const commands = ControlDeckCommandCatalogueSchema.parse({ adapters: [{
    id: 'phoenix.commands', version: '1', label: 'PHOENIX', available: true, simulated: false,
    detail: 'Ready', platformRequirements: [], holdOwner: 'adapter',
    commands: quick.elements.filter(element => element.kind === 'command').map(element => ({
      id: element.target.commandId, label: element.appearance.label, description: 'Open page', category: 'Pages',
      available: true, unavailableReason: null, risk: 'safe', simulated: false, operations: ['tap'], configurationSchema: {}
    }))
  }] })
  const props = {
    category: 'quick' as const, editing: false, macros: emptyMacroRuntime(), variableFontSizes: true,
    controller: { status: 'ready' as const, configuration: DEFAULT_CONTROL_DECK_CONFIGURATION, commands },
    onEditingChange: vi.fn(), onExecuteAction, onExecuteNavigation,
    onSaveConfiguration: async (configuration: typeof DEFAULT_CONTROL_DECK_CONFIGURATION) => configuration
  }
  const renderer = await renderWithAct(<ControlsPage {...props} />)
  const button = () => renderer.root.findAllByType('button').find(node => node.props['aria-label'] === 'System schematic, Open')!
  expect(button().props['data-deskplane-swipe-through']).toBe('')
  await act(async () => button().props.onClick())
  expect(onExecuteNavigation).toHaveBeenCalledWith({ type: 'navigation', destinationId: 'galaxy.current-system' })
  expect(onExecuteAction).not.toHaveBeenCalled()
  const missing = { ...props, controller: { ...props.controller, commands: { adapters: [] } } }
  await act(async () => renderer.update(<ControlsPage {...missing} />))
  expect(button().props.disabled).toBe(true)
  await act(async () => renderer.update(<ControlsPage {...missing} editing />))
  expect(button().props['data-deskplane-swipe-through']).toBeUndefined()
  expect(button().props.disabled).toBe(false)
  await act(async () => button().props.onClick())
  expect(renderer.root.findAll(node => node.children.includes('Button Slot 1:1'))).not.toHaveLength(0)
  expect(onExecuteNavigation).toHaveBeenCalledTimes(1)
  await act(async () => renderer.unmount())
})

test.each(['tap', 'hold'] as const)('game-action buttons opt into swipes only for tap activation: %s', async inputMode => {
  const lights = action('elite.ShipSpotLightToggle', 'ShipSpotLightToggle', 'Ship Lights', 'L')
  const props = {
    category: 'ship' as const, editing: false, macros: emptyMacroRuntime(), variableFontSizes: true,
    controller: {
      status: 'ready' as const, configuration: DEFAULT_CONTROL_DECK_CONFIGURATION,
      actions: {
        backend: { id: 'test', available: true, simulated: true, detail: 'ready' },
        bindingSource: {
          directory: '/bindings', filePath: '/bindings/test.binds', presetNames: ['Test'],
          available: true, bindingCount: 1, keyboardBindingCount: 1,
          loadedAt: '2026-10-06T00:00:00.000Z', error: null
        },
        actions: [{ ...lights, definition: { ...lights.definition, inputMode } }]
      }
    },
    onEditingChange: vi.fn(), onExecuteAction: vi.fn(async () => {}),
    onSaveConfiguration: async (configuration: typeof DEFAULT_CONTROL_DECK_CONFIGURATION) => configuration
  }
  let renderer!: ReturnType<typeof create>
  await act(async () => { renderer = create(<ControlsPage {...props} />) })
  const button = () => renderer.root.findAllByType('button').find(node => node.props['aria-label'] === 'Ship Lights, L')!
  expect(button().props['data-deskplane-swipe-through']).toBe(inputMode === 'tap' ? '' : undefined)
  await act(async () => button().props.onPointerDown({ pointerId: 1, currentTarget: { setPointerCapture: vi.fn() } }))
  if (inputMode === 'hold') expect(props.onExecuteAction).toHaveBeenCalledWith('elite.ShipSpotLightToggle', 'press', expect.any(String))
  else expect(props.onExecuteAction).not.toHaveBeenCalled()
  await act(async () => button().props.onPointerUp({ pointerId: 1 }))
  if (inputMode === 'hold') expect(props.onExecuteAction).toHaveBeenCalledWith('elite.ShipSpotLightToggle', 'release', expect.any(String))
  await act(async () => renderer.update(<ControlsPage {...props} editing />))
  expect(button().props['data-deskplane-swipe-through']).toBeUndefined()
  await act(async () => renderer.unmount())
})

test('button relocation stays in the editing draft until saved, and cancelling discards it', async () => {
  const save = vi.fn(async (configuration: typeof DEFAULT_CONTROL_DECK_CONFIGURATION) => configuration)
  const props = {
    category: 'quick' as const, editing: false, macros: emptyMacroRuntime(), variableFontSizes: true,
    controller: { status: 'ready' as const, configuration: DEFAULT_CONTROL_DECK_CONFIGURATION },
    onEditingChange: vi.fn(), onExecuteAction: vi.fn(), onExecuteNavigation: vi.fn(), onSaveConfiguration: save
  }
  const renderer = await renderWithAct(<ControlsPage {...props} />)
  const surface = () => renderer.root.findByType(ControlSurface)
  const original = surface().props.deck
  const source = original.elements.find((element: { kind: string }) => element.kind === 'command')
  expect(surface().props.onMove).toBeUndefined()
  await act(async () => renderer.update(<ControlsPage {...props} editing />))
  await act(async () => surface().props.onMove(source.id, 2, 1))
  expect(surface().props.deck.elements.find((element: { id: string }) => element.id === source.id).placement.column).toBe(2)
  expect(save).not.toHaveBeenCalled()
  await act(async () => renderer.update(<ControlsPage {...props} />))
  expect(surface().props.deck).toEqual(original)
  await act(async () => renderer.update(<ControlsPage {...props} editing />))
  await act(async () => surface().props.onMove(source.id, 2, 1))
  await act(async () => renderer.root.findAllByType('button').find(button => button.props['aria-label'] === 'Save and finish editing')!.props.onClick())
  expect(save).toHaveBeenCalledOnce()
  expect(save.mock.calls[0]![0].decks.find(deck => deck.id === original.id)!.elements.find(element => element.id === source.id)!.placement.column).toBe(2)
  expect(props.onExecuteAction).not.toHaveBeenCalled()
  expect(props.onExecuteNavigation).not.toHaveBeenCalled()
  await act(async () => renderer.unmount())
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
