import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CopilotHistoryMessage } from '@phoenix/contracts'
import { Button, Status } from '@phoenix/ui'
import { CopilotMarkdown } from './copilot-markdown.js'
import type { RemoteTurn } from './copilot-text-provider.js'

const MESSAGE_BATCH = 30

export const CopilotMessages = memo(function CopilotMessages({ activeTurn, messages, pending, profileName, remoteTurns }: {
  activeTurn?: { assistantText: string, userText: string }
  messages: readonly CopilotHistoryMessage[]
  pending: boolean
  profileName: string
  remoteTurns: Record<string, RemoteTurn>
}) {
  const pane = useRef<HTMLDivElement>(null)
  const followingEnd = useRef(true)
  const scrollAnchor = useRef<{ element: HTMLElement, top: number } | undefined>(undefined)
  const [firstVisibleId, setFirstVisibleId] = useState<string>()
  const anchoredIndex = firstVisibleId === undefined ? -1 : messages.findIndex(item => item.id === firstVisibleId)
  const start = anchoredIndex < 0 ? Math.max(0, messages.length - MESSAGE_BATCH) : anchoredIndex

  useLayoutEffect(() => {
    const anchor = scrollAnchor.current
    if (anchor && pane.current) {
      // React preserves this keyed message when older siblings are prepended.
      // Measuring its position also accommodates native browser scroll anchoring.
      pane.current.scrollTop += anchor.element.getBoundingClientRect().top - anchor.top
      scrollAnchor.current = undefined
    }
  }, [firstVisibleId])

  useEffect(() => {
    if (followingEnd.current && pane.current) pane.current.scrollTop = pane.current.scrollHeight
  }, [activeTurn, messages, remoteTurns])

  const loadOlder = () => {
    const element = pane.current?.querySelector<HTMLElement>('article')
    if (element) scrollAnchor.current = { element, top: element.getBoundingClientRect().top }
    followingEnd.current = false
    setFirstVisibleId(messages[Math.max(0, start - MESSAGE_BATCH)]!.id)
  }
  const turns = Object.values(remoteTurns)
  return <div ref={pane} className="copilot-messages" aria-live="polite" onScroll={event => {
    const element = event.currentTarget
    followingEnd.current = element.scrollHeight - element.scrollTop - element.clientHeight <= 16
    if (!followingEnd.current && firstVisibleId === undefined) setFirstVisibleId(messages[start]?.id)
  }}>
    {start > 0 ? <Button size="sm" variant="outline" onClick={loadOlder}>Load older messages</Button> : null}
    {messages.length === 0 && !activeTurn && turns.length === 0 ? <Status tone="muted">No conversation yet. {profileName} is standing by.</Status> : null}
    {messages.slice(start).map(item => <Message key={item.id} role={item.role} text={item.text || (pending ? '…' : '')} />)}
    {activeTurn?.userText ? <Message role="user" text={activeTurn.userText} live /> : null}
    {activeTurn ? <Message role="assistant" text={activeTurn.assistantText || '…'} live /> : null}
    {turns.flatMap(turn => [turn.userText ? <Message key={`${turn.id}-user`} role="user" text={turn.userText} live /> : null, <Message key={`${turn.id}-assistant`} role="assistant" text={turn.assistantText || '…'} live />])}
  </div>
})

const Message = memo(function Message({ live = false, role, text }: { live?: boolean, role: CopilotHistoryMessage['role'], text: string }) {
  return <article className={`copilot-message copilot-message-${role}${live ? ' live' : ''}`}><small>{role === 'user' ? 'Commander' : role === 'assistant' ? 'Copilot' : 'System'}{live ? ' · live' : ''}</small><div>{role === 'assistant' ? <CopilotMarkdown>{text}</CopilotMarkdown> : text}</div></article>
})
