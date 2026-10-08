import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { CopilotHistoryMessage } from '@phoenix/contracts'
import type { PhoenixApi, CopilotStreamEvent } from '../../application/api/phoenix-api.js'
import type { PhoenixEventHub } from '../../application/events/phoenix-event-hub.js'
import { createClientId, type ClientIdentity } from '../../application/identity/client-identity.js'
import { useCopilotVoice } from './copilot-voice-provider.js'

const CONVERSATION_ID = 'phoenix-copilot'
export interface RemoteTurn { assistantText: string, id: string, userText: string }
interface CopilotTextState {
  messages: readonly CopilotHistoryMessage[]
  pending: boolean
  error?: string
  toolStatus?: string
  remoteTurns: Record<string, RemoteTurn>
  submit(text: string): Promise<void>
}
const CopilotTextContext = createContext<CopilotTextState | undefined>(undefined)

/** A text turn belongs to the application, not the page a display tool can navigate away from. */
export function CopilotTextProvider({ api, clientIdentity, events, children }: {
  api: PhoenixApi
  clientIdentity: ClientIdentity
  events: PhoenixEventHub
  children: ReactNode
}) {
  const voice = useCopilotVoice()
  const [messages, setMessages] = useState<readonly CopilotHistoryMessage[]>([])
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string>()
  const [toolStatus, setToolStatus] = useState<string>()
  const [remoteTurns, setRemoteTurns] = useState<Record<string, RemoteTurn>>({})
  const clientId = clientIdentity.forScope('copilot')
  const lifetime = useRef<{ api: PhoenixApi, abort: AbortController } | undefined>(undefined)
  const historyRequest = useRef<AbortController | undefined>(undefined)
  const streamRequest = useRef<AbortController | undefined>(undefined)

  useEffect(() => {
    const abort = new AbortController()
    lifetime.current = { api, abort }
    setMessages([])
    setRemoteTurns({})
    setPending(false)
    setError(undefined)
    setToolStatus(undefined)
    return () => {
      abort.abort()
      historyRequest.current?.abort()
      streamRequest.current?.abort()
      historyRequest.current = undefined
      streamRequest.current = undefined
    }
  }, [api])

  const loadHistory = useCallback(async (completedLocalTurn = false) => {
    const owner = lifetime.current
    if (!owner || owner.api !== api || owner.abort.signal.aborted) return
    // An earlier snapshot must not replace the optimistic messages of a live local turn.
    // Its completion refresh also picks up any remote/voice turns completed meanwhile.
    if (streamRequest.current && !completedLocalTurn) return
    historyRequest.current?.abort()
    const abort = new AbortController()
    historyRequest.current = abort
    try {
      const result = await api.getCopilotHistory(CONVERSATION_ID, abort.signal)
      if (!abort.signal.aborted && historyRequest.current === abort) setMessages(result.messages)
    } catch (cause) {
      if (!abort.signal.aborted && historyRequest.current === abort) setError(message(cause, 'Conversation history unavailable.'))
    } finally {
      if (historyRequest.current === abort) historyRequest.current = undefined
    }
  }, [api])

  useEffect(() => { void loadHistory() }, [loadHistory, voice.historyVersion])
  useEffect(() => events.subscribe('conversation-event', event => {
    if (event.clientId === clientId || event.conversationId !== CONVERSATION_ID) return
    if (event.type === 'turn.started') setRemoteTurns(turns => ({ ...turns, [event.turnId]: { assistantText: '', id: event.turnId, userText: event.userText } }))
    else if (event.type === 'user.transcript') setRemoteTurns(turns => ({ ...turns, [event.turnId]: { assistantText: turns[event.turnId]?.assistantText ?? '', id: event.turnId, userText: event.text } }))
    else if (event.type === 'assistant.transcript') setRemoteTurns(turns => ({ ...turns, [event.turnId]: { assistantText: event.text, id: event.turnId, userText: turns[event.turnId]?.userText ?? '' } }))
    else if (event.type === 'tool.status') setToolStatus(event.name ? `${event.name}: ${event.status}` : `Tool: ${event.status}`)
    else if (event.type === 'turn.failed') { setRemoteTurns(turns => without(turns, event.turnId)); setError(event.message) }
    else if (event.type === 'turn.cancelled' || event.type === 'turn.completed') {
      setRemoteTurns(turns => without(turns, event.turnId))
      setToolStatus(undefined)
      if (event.type === 'turn.completed') void loadHistory()
    }
  }), [events, clientId, loadHistory])

  const submit = async (candidate: string) => {
    const owner = lifetime.current
    if (!owner || owner.api !== api || owner.abort.signal.aborted) return
    const text = candidate.trim()
    if (!text || streamRequest.current) return
    if (voice.canSendRealtimeText) {
      try { voice.sendText(text); setError(undefined) } catch (cause) { setError(message(cause, 'Realtime message failed.')) }
      return
    }
    const turnId = `text-${createClientId()}`
    const assistantId = `pending-assistant-${turnId}`
    const abort = new AbortController()
    streamRequest.current = abort
    historyRequest.current?.abort()
    setPending(true)
    setError(undefined)
    setToolStatus(undefined)
    setMessages(current => [...current, temporary(`pending-user-${turnId}`, 'user', text), temporary(assistantId, 'assistant', '')])
    const current = () => !abort.signal.aborted && streamRequest.current === abort
    try {
      await api.streamCopilotMessage({ clientId, conversationId: CONVERSATION_ID, message: text, turnId }, event => {
        if (current()) applyStream(event, assistantId, setMessages, setToolStatus)
      }, abort.signal)
      if (current()) await loadHistory(true)
    } catch (cause) {
      if (current()) {
        setMessages(items => items.filter(item => item.id !== assistantId || item.text))
        setError(message(cause, 'Copilot request failed.'))
      }
    } finally {
      if (current()) {
        streamRequest.current = undefined
        setPending(false)
        setToolStatus(undefined)
      }
    }
  }

  return <CopilotTextContext.Provider value={{ messages, pending, error, toolStatus, remoteTurns, submit }}>{children}</CopilotTextContext.Provider>
}

export function useCopilotText(): CopilotTextState {
  const text = useContext(CopilotTextContext)
  if (!text) throw new Error('CopilotTextProvider is missing from the application tree.')
  return text
}

function applyStream(event: CopilotStreamEvent, assistantId: string, setMessages: (update: (messages: readonly CopilotHistoryMessage[]) => readonly CopilotHistoryMessage[]) => void, setTool: (value: string | undefined) => void) {
  if (event.type === 'delta') setMessages(items => items.map(item => item.id === assistantId ? { ...item, text: `${item.text}${event.delta}` } : item))
  else if (event.type === 'reset') setMessages(items => items.map(item => item.id === assistantId ? { ...item, text: '' } : item))
  else if (event.type === 'retrying') setTool(`Provider stream retry ${event.attempt}…`)
  else if (event.type === 'tool') setTool(event.name ? `${event.name}: ${event.status}` : `Tool: ${event.status}`)
}
function temporary(id: string, role: CopilotHistoryMessage['role'], text: string): CopilotHistoryMessage { return { createdAt: new Date().toISOString(), id, role, text } }
function without(turns: Record<string, RemoteTurn>, id: string) { const next = { ...turns }; delete next[id]; return next }
function message(cause: unknown, fallback: string): string { return cause instanceof Error ? cause.message : fallback }
