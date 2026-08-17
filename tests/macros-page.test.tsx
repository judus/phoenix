import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test, vi } from 'vitest'
import { MacrosPage } from '../apps/web/src/features/macros/macros-page.js'
import type { MacroRuntime } from '../apps/web/src/application/macros/macro-runtime.js'

test('Macros renders retained commands and the complete operational action set', () => {
  const markup = renderToStaticMarkup(<MacrosPage runtime={{
    abort: vi.fn(), cancelRecording: vi.fn(), deleteMacro: vi.fn(),
    library: { version: 1, macros: [{
      assumptions: [], description: 'Prepare ship lighting.', enabled: true, id: 'lights',
      name: 'Lights', risk: 'safe', steps: [{ type: 'game-action', actionId: 'elite.ShipSpotLightToggle', operation: 'tap' }], version: 1
    }] },
    play: vi.fn(), recordAction: vi.fn(), save: vi.fn(), setDraft: vi.fn(), startRecording: vi.fn(), stopRecording: vi.fn()
  } as unknown as MacroRuntime} />)

  expect(markup).toContain('Start recording')
  expect(markup).toContain('Saved macros')
  expect(markup).toContain('Prepare ship lighting.')
  expect(markup).toContain('>Run<')
  expect(markup).toContain('>Delete<')
})

test('Macros exposes draft timing and playback abort without claiming game outcome', () => {
  const markup = renderToStaticMarkup(<MacrosPage runtime={{
    abort: vi.fn(), cancelRecording: vi.fn(), deleteMacro: vi.fn(),
    draft: {
      id: '65f4df62-c90c-4f4a-904e-4728d5554a78', clientId: 'browser', startedAt: '2026-08-17T00:00:00.000Z', status: 'stopped',
      entries: [{ actionId: 'elite.ShipSpotLightToggle', delayBeforeMs: 250, message: 'Accepted.', operation: 'tap', status: 'accepted' }]
    },
    library: { version: 1, macros: [] },
    playback: { completedSteps: 0, macroId: 'lights', message: 'Running.', runId: 'run', startedAt: '2026-08-17T00:00:00.000Z', status: 'running', totalSteps: 1 },
    play: vi.fn(), recordAction: vi.fn(), save: vi.fn(), setDraft: vi.fn(), startRecording: vi.fn(), stopRecording: vi.fn()
  } as unknown as MacroRuntime} />)

  expect(markup).toContain('Recorded draft')
  expect(markup).toContain('Playback')
  expect(markup).toContain('>Abort<')
  expect(markup).toContain('does not prove the game outcome')
})
