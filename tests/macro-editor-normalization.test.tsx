import { act, create } from 'react-test-renderer'
import { beforeAll, expect, test, vi } from 'vitest'
import type { MacroDefinition } from '@phoenix/contracts'
import type { MacroRuntime } from '../apps/web/src/application/macros/macro-runtime.js'
import { MacrosPage } from '../apps/web/src/features/macros/macros-page.js'

beforeAll(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }) })

test('saved mixed steps preserve canonical normalization, debounce, deletion and source immutability', async () => {
  vi.useFakeTimers()
  const macro: MacroDefinition = {
    assumptions: [], description: 'Ship sequence', enabled: true, id: 'sequence', name: 'Sequence', risk: 'safe', version: 1,
    steps: [
      { type: 'game-action', actionId: 'elite.One', operation: 'tap' },
      { type: 'wait', durationMs: 750 },
      { type: 'game-action', actionId: 'elite.Two', operation: 'press' },
      { type: 'game-action', actionId: 'elite.Two', operation: 'release' }
    ]
  }
  const original = structuredClone(macro)
  for (const step of macro.steps) Object.freeze(step)
  Object.freeze(macro.steps)
  Object.freeze(macro)
  const save = vi.fn().mockResolvedValue(undefined)
  const runtime = {
    library: { version: 1, macros: [macro] }, save,
    abort: vi.fn(), cancelRecording: vi.fn(), deleteMacro: vi.fn(), play: vi.fn(), recordAction: vi.fn(), startRecording: vi.fn(), stopRecording: vi.fn()
  } as MacroRuntime
  let renderer: ReturnType<typeof create> | undefined
  try {
    await act(async () => { renderer = create(<MacrosPage runtime={runtime} />) })
    const input = (id: string) => renderer!.root.findByProps({ id })
    const delay = () => renderer!.root.findAllByType('input').find(node => node.props['aria-label'] === 'Step 2 duration in milliseconds')!
    await act(async () => {
      input('macro-name').props.onChange({ target: { value: '  Updated sequence  ' } })
    })
    await act(async () => {
      input('macro-description').props.onChange({ target: { value: '  Updated description  ' } })
    })
    await act(async () => {
      delay().props.onChange({ target: { value: '0' } })
    })
    await act(async () => { vi.advanceTimersByTime(399) })
    expect(save).not.toHaveBeenCalled()
    await act(async () => { vi.advanceTimersByTime(1) })
    expect(save).toHaveBeenCalledTimes(1)
    expect(save.mock.calls[0]![0]).toEqual({ ...original, name: 'Updated sequence', description: 'Updated description', steps: [
      original.steps[0], { type: 'wait', durationMs: 0 }, original.steps[2], original.steps[3]
    ] })
    await act(async () => {
      renderer!.root.findAllByType('button').find(node => node.props['aria-label'] === 'Delete step 3')!.props.onClick()
    })
    await act(async () => { vi.advanceTimersByTime(400) })
    expect(save).toHaveBeenCalledTimes(2)
    expect(save.mock.calls[1]![0].steps).toEqual([original.steps[0], { type: 'wait', durationMs: 0 }, original.steps[3]])
    expect(macro).toEqual(original)
  } finally {
    if (renderer) await act(async () => renderer!.unmount())
    vi.useRealTimers()
  }
})
