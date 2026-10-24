import { lazy, useState } from 'react'
import { act } from 'react-test-renderer'
import { afterEach, expect, test, vi } from 'vitest'
import { FeatureBoundary } from '../apps/web/src/bootstrap/feature-boundary.js'
import { renderWithAct } from './support/render-with-act.js'

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

test('a genuinely rejected lazy page preserves navigation and reload starts a new document', async () => {
  const reload = vi.fn()
  vi.stubGlobal('location', { reload })
  const importPage = vi.fn(() => Promise.reject(new Error('Synthetic bundle unavailable')))
  const FailedPage = lazy(importPage)
  const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined)
  const renderer = await renderWithAct(<><nav><a href="#/settings">Settings</a></nav>
    <FeatureBoundary resetKey="copilot"><FailedPage /></FeatureBoundary></>)
  try {
    expect(renderer.root.findByType('a').props.href).toBe('#/settings')
    expect(renderer.root.findByType('h1').children).toEqual(['Page unavailable'])
    expect(errors).toHaveBeenCalled()
    await act(async () => renderer.root.findByType('button').props.onClick())
    expect(reload).toHaveBeenCalledOnce()
    expect(importPage).toHaveBeenCalledOnce()
    await act(async () => renderer.update(<><nav><a href="#/settings">Settings</a></nav>
      <FeatureBoundary resetKey="settings"><p>Settings available</p></FeatureBoundary></>))
    expect(renderer.root.findByType('p').children).toEqual(['Settings available'])
  } finally { await act(async () => renderer.unmount()) }
})

test('healthy page state is not remounted when its route changes', async () => {
  function Page() {
    const [count, setCount] = useState(0)
    return <button onClick={() => setCount(count + 1)}>{count}</button>
  }
  const renderer = await renderWithAct(<FeatureBoundary resetKey="first"><Page /></FeatureBoundary>)
  try {
    await act(async () => renderer.root.findByType('button').props.onClick())
    await act(async () => renderer.update(<FeatureBoundary resetKey="second"><Page /></FeatureBoundary>))
    expect(renderer.root.findByType('button').children).toEqual(['1'])
  } finally { await act(async () => renderer.unmount()) }
})
