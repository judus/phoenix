import { act, create } from 'react-test-renderer'
import { beforeAll, expect, test, vi } from 'vitest'
import type { ControlDeckCommandCatalogue, ControlDeckCommandElement } from 'control-deck/core'
import { ButtonEditor } from '../apps/web/src/features/controls/button-editor.js'

beforeAll(() => Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }))

test('the PHOENIX-owned button editor preserves the shared command element contract', () => {
  const save = vi.fn<(element: ControlDeckCommandElement) => void>()
  let renderer!: ReturnType<typeof create>
  act(() => {
    renderer = create(<ButtonEditor
      catalogue={catalogue('safe')}
      placement={{ kind: 'grid', column: 2, row: 3, columnSpan: 1, rowSpan: 1 }}
      position={{ column: 2, row: 3 }}
      renderCommandOptions={({ onSelect, options }) => <button aria-label="Select command" onClick={() => onSelect(options[0]!)}>Select</button>}
      onClose={() => undefined}
      onRemove={() => undefined}
      onSave={save}
    />)
  })

  act(() => renderer.root.findByProps({ 'aria-label': 'Select command' }).props.onClick())
  act(() => renderer.root.findByProps({ placeholder: 'Default: Landing gear' }).props.onChange({ target: { value: 'Gear' } }))
  act(() => renderer.root.findByProps({ 'aria-label': 'Save button' }).props.onClick())

  expect(save).toHaveBeenCalledOnce()
  expect(save.mock.calls[0]?.[0]).toMatchObject({
    kind: 'command',
    target: { adapterId: 'phoenix.commands', commandId: 'command.elite.LandingGearToggle', configuration: {} },
    placement: { kind: 'grid', column: 2, row: 3, columnSpan: 1, rowSpan: 1 },
    appearance: { label: 'Gear' },
    interaction: { activation: 'tap', confirmation: { kind: 'none' } }
  })
})

test('dangerous PHOENIX commands default to confirmation and retain the configured timeout', () => {
  const save = vi.fn<(element: ControlDeckCommandElement) => void>()
  let renderer!: ReturnType<typeof create>
  act(() => {
    renderer = create(<ButtonEditor
      catalogue={catalogue('dangerous')}
      position={{ column: 1, row: 1 }}
      renderCommandOptions={() => null}
      onClose={() => undefined}
      onRemove={() => undefined}
      onSave={save}
    />)
  })

  const timeout = renderer.root.findByProps({ className: 'button-editor-arming-window' }).findByType('input')
  act(() => timeout.props.onChange({ target: { value: '8' } }))
  act(() => renderer.root.findByProps({ 'aria-label': 'Save button' }).props.onClick())

  expect(save.mock.calls[0]?.[0].interaction).toEqual({
    activation: 'tap',
    confirmation: { kind: 'arm-then-tap', armedForMs: 8_000 }
  })
})

function catalogue(risk: 'safe' | 'dangerous'): ControlDeckCommandCatalogue {
  return {
    adapters: [{
      id: 'phoenix.commands',
      version: '1',
      label: 'PHOENIX',
      available: true,
      simulated: false,
      detail: 'Ready.',
      platformRequirements: [],
      holdOwner: 'adapter',
      commands: [{
        id: 'command.elite.LandingGearToggle',
        label: 'Landing gear',
        description: 'Toggle landing gear.',
        category: 'Ship',
        bindingLabel: 'L',
        available: true,
        unavailableReason: null,
        risk,
        simulated: false,
        operations: ['tap'],
        configurationSchema: { type: 'object', maxProperties: 0 }
      }]
    }]
  }
}
