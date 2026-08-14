import { memo, useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import {
  CopilotConversationEventSchema,
  type CopilotHistoryMessage,
  type HealthResponse
} from '@phoenix/contracts'
import {
  PhoenixApiClient,
  type CopilotStreamEvent
} from '../api/phoenix-api-client.js'
import { subscribePhoenixEvent } from '../api/phoenix-event-stream.js'
import { Page, PageContent, PageHeader } from '../components/layout/page.js'
import { PhoenixShell } from '../components/layout/phoenix-shell.js'
import type { NavigationItem } from '../components/navigation/navigation.js'
import { useCopilotVoice } from '../features/copilot/copilot-voice-provider.js'
import { CopilotVoiceToggle } from '../features/copilot/copilot-voice-toggle.js'
import { CopilotMarkdown } from '../features/copilot/copilot-markdown.js'
import {
  copilotClientId,
  createCopilotId
} from '../features/copilot/copilot-client-identity.js'

const DEFAULT_CONVERSATION_ID = 'phoenix-copilot'
const navigation: NavigationItem[] = [
  { href: '#copilot', icon: '◈', id: 'chat', label: 'Chat' }
]

export interface CopilotPageProps {
  api: PhoenixApiClient
  error?: string
  health?: HealthResponse
}

interface RemoteTurn {
  assistantText: string
  id: string
  userText: string
}

export function CopilotPage ({ api, error, health }: CopilotPageProps) {
  const voice = useCopilotVoice()
  const [messages, setMessages] = useState<readonly CopilotHistoryMessage[]>([])
  const [pending, setPending] = useState(false)
  const [chatError, setChatError] = useState<string>()
  const [toolStatus, setToolStatus] = useState<string>()
  const [remoteTurns, setRemoteTurns] = useState<Record<string, RemoteTurn>>({})
  const clientIdRef = useRef(copilotClientId())

  const loadHistory = async (): Promise<void> => {
    const history = await api.getCopilotHistory(DEFAULT_CONVERSATION_ID)
    setMessages(history.messages)
  }

  useEffect(() => {
    void loadHistory().catch(cause => {
      setChatError(cause instanceof Error ? cause.message : 'Conversation history unavailable.')
    })
  }, [voice.historyVersion])

  useEffect(() => {
    if (typeof EventSource === 'undefined') return
    const unsubscribe = subscribePhoenixEvent(api, 'conversation-event', rawEvent => {
      try {
        const event = CopilotConversationEventSchema.parse(JSON.parse((rawEvent as MessageEvent).data))
        if (event.clientId === clientIdRef.current) return
        if (event.type === 'turn.started') {
          setRemoteTurns(turns => ({
            ...turns,
            [event.turnId]: { assistantText: '', id: event.turnId, userText: event.userText }
          }))
        } else if (event.type === 'user.transcript') {
          setRemoteTurns(turns => ({
            ...turns,
            [event.turnId]: {
              assistantText: turns[event.turnId]?.assistantText ?? '',
              id: event.turnId,
              userText: event.text
            }
          }))
        } else if (event.type === 'assistant.transcript') {
          setRemoteTurns(turns => ({
            ...turns,
            [event.turnId]: {
              assistantText: event.text,
              id: event.turnId,
              userText: turns[event.turnId]?.userText ?? ''
            }
          }))
        } else if (event.type === 'tool.status') {
          setToolStatus(event.name ? `${event.name}: ${event.status}` : `Tool: ${event.status}`)
        } else if (event.type === 'turn.cancelled') {
          setRemoteTurns(turns => withoutTurn(turns, event.turnId))
          setToolStatus(undefined)
        } else if (event.type === 'turn.completed') {
          setRemoteTurns(turns => withoutTurn(turns, event.turnId))
          setToolStatus(undefined)
          void loadHistory().catch(cause => setChatError(
            cause instanceof Error ? cause.message : 'Conversation history unavailable.'
          ))
        } else if (event.type === 'turn.failed') {
          setRemoteTurns(turns => withoutTurn(turns, event.turnId))
          setChatError(event.message)
        }
      } catch {
        setChatError('Received an invalid live Copilot event.')
      }
    })
    return unsubscribe
  }, [api])

  const submit = useCallback(async (candidate: string): Promise<void> => {
    const text = candidate.trim()
    if (!text || pending) return
    if (voice.canSendRealtimeText) {
      try {
        voice.sendText(text)
        setChatError(undefined)
      } catch (cause) {
        setChatError(cause instanceof Error ? cause.message : 'Realtime message failed.')
      }
      return
    }
    const turnId = createCopilotId()
    const userId = `pending-user-${turnId}`
    const assistantId = `pending-assistant-${turnId}`
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
        clientId: clientIdRef.current,
        conversationId: DEFAULT_CONVERSATION_ID,
        message: text,
        turnId
      }, event => applyStreamEvent(event, assistantId, setMessages, setToolStatus))
      await loadHistory()
    } catch (cause) {
      setMessages(previous => previous.filter(message => message.id !== assistantId || message.text))
      setChatError(cause instanceof Error ? cause.message : 'Copilot request failed.')
    } finally {
      setPending(false)
      setToolStatus(undefined)
    }
  }, [api, pending, voice])

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
            <aside className="copilot-sidebar" aria-label="Copilot profile">
              <h2>Copilot profile</h2>
              {voice.profiles.map(profile => (
                <button
                  className="copilot-profile"
                  type="button"
                  key={profile.id}
                  aria-pressed={profile.id === voice.activeProfile.id}
                  disabled={voice.connected || voice.transitioning}
                  title={profile.description}
                  onClick={() => {
                    void voice.selectProfile(profile.id).catch(cause => setChatError(
                      cause instanceof Error ? cause.message : 'Unable to change Copilot profile.'
                    ))
                  }}
                >
                  <span className="copilot-profile__mark">{profile.mark}</span>
                  <span>
                    <strong>{profile.name.toUpperCase()}</strong>
                    <small>{profile.id === voice.activeProfile.id ? 'Active profile' : profile.description}</small>
                  </span>
                </button>
              ))}
            </aside>

            <section className="copilot-chat" aria-label="Copilot conversation">
              <CopilotMessageHistory
                activeTurn={voice.activeTurn}
                messages={messages}
                pending={pending}
                profileName={voice.activeProfile.name}
                remoteTurns={remoteTurns}
              />
              {(toolStatus ?? voice.toolStatus) && (
                <p className="copilot-tool-status">{toolStatus ?? voice.toolStatus}</p>
              )}
              {(chatError ?? voice.error) && (
                <p className="copilot-error" role="alert">{chatError ?? voice.error}</p>
              )}
              <CopilotComposer
                disabled={pending}
                profileName={voice.activeProfile.name}
                onSubmitText={submit}
              />
            </section>

            <aside className="copilot-sidebar copilot-voice" aria-label="Voice controls">
              <h2>Voice channel</h2>
              <div className={`copilot-voice__status${voice.connected ? ' is-connected' : ''}`}>
                <strong>{voice.status}</strong>
                <span>{voice.hostLocation === 'remote'
                  ? 'Audio hosted by the desktop browser'
                  : voice.connected ? 'Always listening' : 'Connect this PC microphone'}</span>
                {voice.audioStatus && <span>{voice.audioStatus}</span>}
              </div>
              <label>
                Microphone
                <select
                  value={voice.inputId}
                  disabled={voice.connected || voice.hostLocation === 'remote'}
                  onChange={event => voice.setInputId(event.target.value)}
                >
                  <option value="">System default</option>
                  {voice.devices.inputs.map(device => (
                    <option key={device.id} value={device.id}>{device.label}</option>
                  ))}
                </select>
              </label>
              <label>
                Audio output
                <select
                  value={voice.outputId}
                  disabled={voice.connected || voice.hostLocation === 'remote'}
                  onChange={event => voice.setOutputId(event.target.value)}
                >
                  <option value="">System default</option>
                  {voice.devices.outputs.map(device => (
                    <option key={device.id} value={device.id}>{device.label}</option>
                  ))}
                </select>
              </label>
              <CopilotVoiceToggle voice={voice} />
            </aside>
          </div>
        </PageContent>
      </Page>
    </PhoenixShell>
  )
}

interface CopilotMessageHistoryProps {
  activeTurn?: { assistantText: string, userText: string }
  messages: readonly CopilotHistoryMessage[]
  pending: boolean
  profileName: string
  remoteTurns: Record<string, RemoteTurn>
}

const CopilotMessageHistory = memo(function CopilotMessageHistory ({
  activeTurn,
  messages,
  pending,
  profileName,
  remoteTurns
}: CopilotMessageHistoryProps) {
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [activeTurn, messages, remoteTurns])

  return (
    <div className="copilot-messages" aria-live="polite">
      {messages.length === 0 && <p className="copilot-empty">No conversation yet. {profileName} is standing by.</p>}
      {messages.map(message => (
        <article key={message.id} className={`copilot-message copilot-message--${message.role}`}>
          <span>{message.role === 'user' ? 'Commander' : 'Copilot'}</span>
          <div className="copilot-message__text">
            {message.role === 'assistant'
              ? <CopilotMarkdown>{message.text || (pending ? '…' : '')}</CopilotMarkdown>
              : message.text}
          </div>
        </article>
      ))}
      {activeTurn?.userText && (
        <article className="copilot-message copilot-message--user copilot-message--live">
          <span>Commander · live</span>
          <div className="copilot-message__text">{activeTurn.userText}</div>
        </article>
      )}
      {activeTurn && (
        <article className="copilot-message copilot-message--assistant copilot-message--live">
          <span>Copilot · live</span>
          <div className="copilot-message__text"><CopilotMarkdown>{activeTurn.assistantText || '…'}</CopilotMarkdown></div>
        </article>
      )}
      {Object.values(remoteTurns).map(turn => (
        <div key={turn.id} className="copilot-live-turn">
          {turn.userText && (
            <article className="copilot-message copilot-message--user copilot-message--live">
              <span>Commander · live</span>
              <div className="copilot-message__text">{turn.userText}</div>
            </article>
          )}
          <article className="copilot-message copilot-message--assistant copilot-message--live">
            <span>Copilot · live</span>
            <div className="copilot-message__text"><CopilotMarkdown>{turn.assistantText || '…'}</CopilotMarkdown></div>
          </article>
        </div>
      ))}
      <div ref={endRef} />
    </div>
  )
})

const CopilotComposer = memo(function CopilotComposer ({
  disabled,
  profileName,
  onSubmitText
}: {
  disabled: boolean
  profileName: string
  onSubmitText: (text: string) => Promise<void>
}) {
  const [composer, setComposer] = useState('')

  const submit = (event: FormEvent): void => {
    event.preventDefault()
    const text = composer.trim()
    if (!text || disabled) return
    setComposer('')
    void onSubmitText(text)
  }

  return (
    <form className="copilot-composer" onSubmit={submit}>
      <label htmlFor="copilot-message">Message Copilot</label>
      <textarea
        id="copilot-message"
        value={composer}
        disabled={disabled}
        placeholder={`Ask ${profileName}…`}
        rows={3}
        onChange={event => setComposer(event.target.value)}
        onKeyDown={event => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault()
            event.currentTarget.form?.requestSubmit()
          }
        }}
      />
      <button type="submit" disabled={disabled || !composer.trim()}>
        {disabled ? 'Transmitting…' : 'Send'}
      </button>
    </form>
  )
})

function withoutTurn (
  turns: Record<string, RemoteTurn>,
  turnId: string
): Record<string, RemoteTurn> {
  const next = { ...turns }
  delete next[turnId]
  return next
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
