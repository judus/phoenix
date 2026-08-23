import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test, vi } from 'vitest'
import { MacrosPage } from '../apps/web/src/features/macros/macros-page.js'
import type { MacroRuntime } from '../apps/web/src/application/macros/macro-runtime.js'
import { macroDefinitionFromRecording } from '../apps/web/src/application/macros/macro-definition.js'

test('Macros renders retained commands and library actions', () => {
  const markup = renderToStaticMarkup(<MacrosPage runtime={{
    abort: vi.fn(), cancelRecording: vi.fn(), deleteMacro: vi.fn(),
    library: { version: 1, macros: [{
      assumptions: [], description: 'Prepare ship lighting.', enabled: true, id: 'lights',
      name: 'Lights', risk: 'safe', steps: [{ type: 'game-action', actionId: 'elite.ShipSpotLightToggle', operation: 'tap' }], version: 1
    }] },
    play: vi.fn(), recordAction: vi.fn(), save: vi.fn(), startRecording: vi.fn(), stopRecording: vi.fn()
  } as unknown as MacroRuntime} />)

  expect(markup).toContain('Add macro')
  expect(markup).toContain('>Macros<')
  expect(markup).toContain('Macro steps')
  expect(markup).toContain('col-fill')
  expect(markup).toContain('col-fit numeric')
  expect(markup).toContain('Prepare ship lighting.')
  expect(markup).toContain('Delete macro')
  expect(markup).toContain('Delete step 1')
})

test('Macros exposes playback abort without claiming game outcome', () => {
  const markup = renderToStaticMarkup(<MacrosPage runtime={{
    abort: vi.fn(), cancelRecording: vi.fn(), deleteMacro: vi.fn(),
    library: { version: 1, macros: [] },
    playback: { completedSteps: 0, macroId: 'lights', message: 'Running.', runId: 'run', startedAt: '2026-08-17T00:00:00.000Z', status: 'running', totalSteps: 1 },
    play: vi.fn(), recordAction: vi.fn(), save: vi.fn(), startRecording: vi.fn(), stopRecording: vi.fn()
  } as unknown as MacroRuntime} />)

  expect(markup).toContain('Playback')
  expect(markup).toContain('>Abort<')
  expect(markup).toContain('Select a saved macro or add a new one.')
})

test('recorded delays become editable macro steps', () => {
  const macro = macroDefinitionFromRecording('Launch sequence', {
    id: '65f4df62-c90c-4f4a-904e-4728d5554a78', clientId: 'browser', startedAt: '2026-08-17T00:00:00.000Z', status: 'stopped',
    entries: [
      { actionId: 'elite.LandingGearToggle', delayBeforeMs: 0, message: 'Accepted.', operation: 'tap', status: 'accepted' },
      { actionId: 'elite.ShipSpotLightToggle', delayBeforeMs: 750, message: 'Accepted.', operation: 'tap', status: 'accepted' }
    ]
  })

  expect(macro.id).toBe('launch-sequence')
  expect(macro.steps).toEqual([
    { type: 'game-action', actionId: 'elite.LandingGearToggle', operation: 'tap' },
    { type: 'wait', durationMs: 750 },
    { type: 'game-action', actionId: 'elite.ShipSpotLightToggle', operation: 'tap' }
  ])
})
