import { act, create } from 'react-test-renderer'
import { beforeAll, expect, test, vi } from 'vitest'
import { useWorkspaceFocus } from '../apps/web/src/components/shell/use-workspace-focus.js'

beforeAll(() => Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }))

test('focus view toggles explicitly and Escape exits it', () => {
  const listeners = new Set<(event: KeyboardEvent) => void>()
  const add = vi.fn((type: string, listener: EventListenerOrEventListenerObject) => {
    if (type === 'keydown') listeners.add(listener as (event: KeyboardEvent) => void)
  })
  const remove = vi.fn((type: string, listener: EventListenerOrEventListenerObject) => {
    if (type === 'keydown') listeners.delete(listener as (event: KeyboardEvent) => void)
  })
  vi.stubGlobal('addEventListener', add)
  vi.stubGlobal('removeEventListener', remove)

  try {
    let renderer!: ReturnType<typeof create>
    act(() => { renderer = create(<FocusHarness />) })
    const button = renderer.root.findByType('button')

    act(() => button.props.onClick())
    expect(renderer.root.findByType('main').props['data-active']).toBe(true)

    const preventDefault = vi.fn()
    act(() => {
      for (const listener of listeners) listener({ key: 'Escape', preventDefault } as unknown as KeyboardEvent)
    })
    expect(preventDefault).toHaveBeenCalledOnce()
    expect(renderer.root.findByType('main').props['data-active']).toBe(false)
  } finally {
    vi.unstubAllGlobals()
  }
})

function FocusHarness() {
  const focus = useWorkspaceFocus()
  return <main data-active={focus.active}><button type="button" onClick={focus.toggle}>Focus</button></main>
}
