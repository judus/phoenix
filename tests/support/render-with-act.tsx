import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import type { ReactElement } from 'react'

/** Return the mounted renderer after React has flushed its initial effects. */
export async function renderWithAct(element: ReactElement, options?: Parameters<typeof create>[1]): Promise<ReactTestRenderer> {
  let renderer: ReactTestRenderer | undefined
  await act(async () => { renderer = create(element, options) })
  if (!renderer) throw new Error('React did not create the test renderer')
  return renderer
}
