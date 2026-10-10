import { act } from 'react-test-renderer'
import { useState } from 'react'
import { beforeAll, expect, test, vi } from 'vitest'
import { ViewSwitcher, ViewToggle } from '@phoenix/ui'
import { renderWithAct } from './support/render-with-act.js'

beforeAll(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }) })

test('square view toggle shows only the destination icon and changes its accessible name', async () => {
  const changed = vi.fn()
  function Probe() {
    const [position, setPosition] = useState<'start' | 'end'>('end')
    return <ViewToggle startLabel="Table" startIcon={<svg aria-label="Table icon" />} endLabel="Atlas" endIcon={<svg aria-label="Atlas icon" />}
      position={position} onPositionChange={next => { changed(next); setPosition(next) }} />
  }
  const renderer = await renderWithAct(<Probe />)
  const button = () => renderer.root.findByType('button')
  expect(button().props['aria-label']).toBe('Show table view')
  expect(button().props.className).toContain('btn-icon-square')
  expect(button().findByType('svg').props['aria-label']).toBe('Table icon')
  expect(button().props.role).toBeUndefined()
  await act(async () => button().props.onClick())
  expect(changed).toHaveBeenLastCalledWith('start')
  expect(button().props['aria-label']).toBe('Show atlas view')
  expect(button().findByType('svg').props['aria-label']).toBe('Atlas icon')
  await act(async () => button().props.onClick())
  expect(changed).toHaveBeenLastCalledWith('end')
  await act(async () => renderer.unmount())
})

test('the original sliding switcher remains available for non-content uses', async () => {
  const renderer = await renderWithAct(<ViewSwitcher startLabel="A" startIcon={<svg />} endLabel="B" endIcon={<svg />} position="start" onPositionChange={vi.fn()} />)
  expect(renderer.root.findByType('button').props.role).toBe('switch')
  expect(renderer.root.findAllByType('svg')).toHaveLength(2)
  await act(async () => renderer.unmount())
})
