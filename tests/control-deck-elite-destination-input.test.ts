import { expect, test, vi } from 'vitest'
import type { KeyboardCommandConfiguration, KeyboardOutput } from 'control-deck/adapter-keyboard'
import type { EliteDangerousBindingSource } from 'control-deck/integration-elite-dangerous'
import { ControlDeckEliteDestinationInput } from '../apps/server/src/infrastructure/control-deck-elite-destination-input.js'

test('Elite destination input resolves semantic bindings and types generated system names through the platform backend', async () => {
  const send = vi.fn<KeyboardOutput['send']>().mockResolvedValue(undefined)
  const input = new ControlDeckEliteDestinationInput(bindings(), output(send))

  await input.tap('GalaxyMapOpen')
  await input.typeText('Col 285-1')

  expect(send.mock.calls.map(([, binding]) => ({ key: binding.key, modifiers: binding.modifiers }))).toEqual([
    { key: 'g', modifiers: [] },
    { key: 'c', modifiers: [] },
    { key: 'o', modifiers: [] },
    { key: 'l', modifiers: [] },
    { key: 'Space', modifiers: [] },
    { key: '2', modifiers: [] },
    { key: '8', modifiers: [] },
    { key: '5', modifiers: [] },
    { key: 'Minus', modifiers: [] },
    { key: '1', modifiers: [] }
  ])
})

test('Elite destination input reports every required missing semantic binding before execution', () => {
  const source = bindings()
  source.resolve = binding => binding === 'UI_Right' || binding === 'CamZoomIn' ? null : { key: 'x', modifiers: [], display: 'X' }
  const input = new ControlDeckEliteDestinationInput(source, output(vi.fn()))

  expect(input.getStatus()).toEqual({
    available: false,
    detail: 'Elite bindings are missing: UI_Right, CamZoomIn.',
    missingBindings: ['UI_Right', 'CamZoomIn']
  })
})

function output (send: KeyboardOutput['send']): KeyboardOutput {
  return {
    getStatus: () => ({ available: true, detail: 'Ready.', platformRequirements: [], simulated: false }),
    send
  }
}

function bindings (): EliteDangerousBindingSource {
  const resolved: KeyboardCommandConfiguration & { display: string } = { key: 'g', modifiers: [], display: 'G' }
  return {
    getDiagnostics: () => ({ available: true, bindingCount: 5, directory: '/bindings', error: null, filePath: '/bindings/custom.binds', keyboardBindingCount: 5, loadedAt: '2026-09-11T12:00:00.000Z', presetNames: ['Custom'] }),
    listBindings: () => [],
    listCommands: () => [],
    refresh: () => ({ available: true, bindingCount: 5, directory: '/bindings', error: null, filePath: '/bindings/custom.binds', keyboardBindingCount: 5, loadedAt: '2026-09-11T12:00:00.000Z', presetNames: ['Custom'] }),
    resolve: () => resolved,
    startWatching: () => {},
    stopWatching: () => {}
  }
}
