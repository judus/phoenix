import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { beforeAll, expect, test } from 'vitest'
import type { CopilotHistoryMessage } from '@phoenix/contracts'
import { CopilotMessages } from '../apps/web/src/features/copilot/copilot-messages.js'

beforeAll(() => Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }))
const history = (count: number): CopilotHistoryMessage[] => Array.from({ length: count }, (_, i) => ({ id: `message-${i}`, role: 'user', text: `Message ${i}`, createdAt: '2026-10-09T00:00:00Z' }))
const view = (messages: readonly CopilotHistoryMessage[]) => <CopilotMessages messages={messages} remoteTurns={{}} pending={false} profileName="Marin" />
const articles = (renderer: ReactTestRenderer) => renderer.root.findAllByType('article')

test('large and asynchronously loaded histories render a recent window, with every older message reachable', async () => {
  const messages = history(800)
  let renderer!: ReactTestRenderer
  await act(async () => { renderer = create(view([])) })
  try {
    await act(async () => renderer.update(view(messages)))
    expect(articles(renderer)).toHaveLength(30)
    expect(JSON.stringify(renderer.toJSON())).toContain('Message 799')
    expect(JSON.stringify(renderer.toJSON())).not.toContain('Message 769')
    for (let n = 0; n < 26; n++) await act(async () => renderer.root.findByType('button').props.onClick())
    expect(articles(renderer)).toHaveLength(800)
    expect(renderer.root.findAllByType('button')).toHaveLength(0)
    expect(messages).toHaveLength(800)
    await act(async () => renderer.unmount())
    await act(async () => { renderer = create(view(messages)) })
    expect(articles(renderer)).toHaveLength(30)
  } finally { await act(async () => renderer.unmount()) }
})

test('prepending older messages preserves the visible anchor and new replies do not pull readers to the bottom', async () => {
  const messages = history(100)
  let anchorTop = 100
  const anchor = { getBoundingClientRect: () => ({ top: anchorTop }) }
  const pane = { scrollTop: 0, scrollHeight: 1000, clientHeight: 400, querySelector: () => anchor }
  let renderer!: ReactTestRenderer
  await act(async () => { renderer = create(view(messages), { createNodeMock: element => (element.props as { className?: string }).className === 'copilot-messages' ? pane : null }) })
  try {
    expect(pane.scrollTop).toBe(1000)
    pane.scrollTop = 200
    act(() => renderer.root.findByProps({ className: 'copilot-messages' }).props.onScroll({ currentTarget: pane }))
    act(() => {
      renderer.root.findByType('button').props.onClick()
      anchorTop = 700
      pane.scrollHeight = 1600
    })
    expect(pane.scrollTop).toBe(800)
    expect(articles(renderer)).toHaveLength(60)
    pane.scrollHeight = 1700
    await act(async () => renderer.update(view([...messages, ...history(1).map(item => ({ ...item, id: 'new', text: 'New reply' }))])))
    expect(pane.scrollTop).toBe(800)
    expect(articles(renderer)).toHaveLength(61)
    pane.scrollTop = 1300
    act(() => renderer.root.findByProps({ className: 'copilot-messages' }).props.onScroll({ currentTarget: pane }))
    pane.scrollHeight = 1800
    await act(async () => renderer.update(view([...messages, { ...messages[0]!, id: 'newer', text: 'Follow this reply' }])))
    expect(pane.scrollTop).toBe(1800)
  } finally { await act(async () => renderer.unmount()) }
})
