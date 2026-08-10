import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { CopilotHistoryMessage, HealthResponse } from '@phoenix/contracts'
import {
  PhoenixApiClient,
  type CopilotStreamEvent
} from '../api/phoenix-api-client.js'
import { Page, PageContent, PageHeader } from '../components/layout/page.js'
import { PhoenixShell } from '../components/layout/phoenix-shell.js'
import type { NavigationItem } from '../components/navigation/navigation.js'

const DEFAULT_CONVERSATION_ID = 'phoenix-copilot'
const navigation: NavigationItem[] = [
  { href: '#copilot', icon: '◈', id: 'chat', label: 'Chat' }
]

export interface CopilotPageProps {
  api: PhoenixApiClient
  error?: string
  health?: HealthResponse
}

export function CopilotPage ({ api, error, health }: CopilotPageProps) {
  const [messages, setMessages] = useState<readonly CopilotHistoryMessage[]>([])
  const [composer, setComposer] = useState('')
  const [pending, setPending] = useState(false)
  const [chatError, setChatError] = useState<string>()
  const [toolStatus, setToolStatus] = useState<string>()
  const endRef = useRef<HTMLDivElement>(null)

  const loadHistory = async (): Promise<void> => {
    const history = await api.getCopilotHistory(DEFAULT_CONVERSATION_ID)
    setMessages(history.messages)
  }

  useEffect(() => {
    void loadHistory().catch(cause => {
      setChatError(cause instanceof Error ? cause.message : 'Conversation history unavailable.')
    })
  }, [])

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [messages])

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    const text = composer.trim()
    if (!text || pending) return
    const userId = `pending-user-${crypto.randomUUID()}`
    const assistantId = `pending-assistant-${crypto.randomUUID()}`
    setComposer('')
    setChatError(undefined)
    setToolStatus(undefined)
    setPending(true)
    setMessages(previous => [
      ...previous,
      temporaryMessage(userId, 'user', text),
      temporaryMessage(assistantId, 'assistant', '')
    ])

    try {
      await api.streamCopilotMessage({
        conversationId: DEFAULT_CONVERSATION_ID,
        message: text,
        profileId: 'icarus'
      }, event => applyStreamEvent(event, assistantId, setMessages, setToolStatus))
      await loadHistory()
    } catch (cause) {
      setMessages(previous => previous.filter(message => message.id !== assistantId || message.text))
      setChatError(cause instanceof Error ? cause.message : 'Copilot request failed.')
    } finally {
      setPending(false)
      setToolStatus(undefined)
    }
  }

  return (
    <PhoenixShell
      activePrimaryItemId="copilot"
      activeSecondaryItemId="chat"
      error={error}
      health={health}
      secondaryNavigation={navigation}
    >
      <Page className="copilot-page">
        <PageHeader
          title="Copilot"
          eyebrow="Text channel"
          description="Persistent shipboard conversation with current PHOENIX telemetry."
        />
        <PageContent>
          <div className="copilot-workspace">
            <aside className="copilot-sidebar" aria-label="Agent profile">
              <h2>Agent profile</h2>
              <button className="copilot-profile" type="button" aria-pressed="true">
                <span className="copilot-profile__mark">I</span>
                <span><strong>ICARUS</strong><small>Active profile</small></span>
              </button>
            </aside>

            <section className="copilot-chat" aria-label="Copilot conversation">
              <div className="copilot-messages" aria-live="polite">
                {messages.length === 0 && (
                  <p className="copilot-empty">No conversation yet. ICARUS is standing by.</p>
                )}
                {messages.map(message => (
                  <article key={message.id} className={`copilot-message copilot-message--${message.role}`}>
                    <span>{message.role === 'user' ? 'Commander' : message.role}</span>
                    <p>{message.text || (pending ? '…' : '')}</p>
                  </article>
                ))}
                <div ref={endRef} />
              </div>
              {toolStatus && <p className="copilot-tool-status">{toolStatus}</p>}
              {chatError && <p className="copilot-error" role="alert">{chatError}</p>}
              <form className="copilot-composer" onSubmit={event => void submit(event)}>
                <label htmlFor="copilot-message">Message Copilot</label>
                <textarea
                  id="copilot-message"
                  value={composer}
                  disabled={pending}
                  placeholder="Ask ICARUS…"
                  rows={3}
                  onChange={event => setComposer(event.target.value)}
                  onKeyDown={event => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault()
                      event.currentTarget.form?.requestSubmit()
                    }
                  }}
                />
                <button type="submit" disabled={pending || !composer.trim()}>
                  {pending ? 'Transmitting…' : 'Send'}
                </button>
              </form>
            </section>

            <aside className="copilot-sidebar copilot-voice" aria-label="Voice controls">
              <h2>Voice channel</h2>
              <div className="copilot-voice__status">
                <strong>Offline</strong>
                <span>Realtime migration pending</span>
              </div>
              <button type="button" disabled>Connect realtime</button>
            </aside>
          </div>
        </PageContent>
      </Page>
    </PhoenixShell>
  )
}

function applyStreamEvent (
  event: CopilotStreamEvent,
  assistantId: string,
  setMessages: (update: (messages: readonly CopilotHistoryMessage[]) => readonly CopilotHistoryMessage[]) => void,
  setToolStatus: (status: string | undefined) => void
): void {
  if (event.type === 'delta') {
    setMessages(messages => messages.map(message => message.id === assistantId
      ? { ...message, text: `${message.text}${event.delta}` }
      : message))
  } else if (event.type === 'reset') {
    setMessages(messages => messages.map(message => message.id === assistantId
      ? { ...message, text: '' }
      : message))
  } else if (event.type === 'retrying') {
    setToolStatus(`Provider stream retry ${event.attempt}…`)
  } else if (event.type === 'tool') {
    setToolStatus(event.name ? `${event.name}: ${event.status}` : `Tool: ${event.status}`)
  }
}

function temporaryMessage (
  id: string,
  role: CopilotHistoryMessage['role'],
  text: string
): CopilotHistoryMessage {
  return {
    createdAt: new Date().toISOString(),
    id,
    role,
    text
  }
}
