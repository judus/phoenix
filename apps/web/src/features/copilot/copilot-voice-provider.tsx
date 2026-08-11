import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode
} from 'react'
import type { CopilotConversationEvent } from '@phoenix/contracts'
import { PhoenixApiClient } from '../../api/phoenix-api-client.js'
import { copilotClientId } from './copilot-client-identity.js'
import {
  createRealtimeAudioSession,
  signalLevel,
  type AudioProcessingSession
} from './realtime-audio.js'

const CONVERSATION_ID = 'phoenix-copilot'

export interface VoiceDevice {
  id: string
  label: string
}

export interface ActiveVoiceTurn {
  assistantText: string
  id: string
  source: 'transcribed' | 'typed'
  userText: string
}

export interface CopilotVoiceState {
  activeTurn?: ActiveVoiceTurn
  audioStatus?: string
  connect(): Promise<void>
  connected: boolean
  devices: { inputs: readonly VoiceDevice[], outputs: readonly VoiceDevice[] }
  disconnect(): void
  error?: string
  historyVersion: number
  inputId: string
  outputId: string
  sendText(text: string): void
  setInputId(id: string): void
  setOutputId(id: string): void
  status: string
  toolStatus?: string
}

interface MutableTurn extends ActiveVoiceTurn {
  persisting?: boolean
  responseDone?: boolean
  responseRequested?: boolean
}

type ConversationEventPayload = CopilotConversationEvent extends infer Event
  ? Event extends CopilotConversationEvent
    ? Omit<Event, 'clientId' | 'conversationId' | 'occurredAt' | 'turnId'>
    : never
  : never

const CopilotVoiceContext = createContext<CopilotVoiceState | undefined>(undefined)

export function CopilotVoiceProvider ({ children }: { children: ReactNode }) {
  const apiRef = useRef(new PhoenixApiClient())
  const clientIdRef = useRef(copilotClientId())
  const [connected, setConnected] = useState(false)
  const [status, setStatus] = useState('Offline')
  const [error, setError] = useState<string>()
  const [toolStatus, setToolStatus] = useState<string>()
  const [audioStatus, setAudioStatus] = useState<string>()
  const [devices, setDevices] = useState<{ inputs: VoiceDevice[], outputs: VoiceDevice[] }>({
    inputs: [], outputs: []
  })
  const [inputId, setInputId] = useState('')
  const [outputId, setOutputId] = useState('')
  const [activeTurn, setActiveTurn] = useState<ActiveVoiceTurn>()
  const [historyVersion, setHistoryVersion] = useState(0)
  const socketRef = useRef<WebSocket | undefined>(undefined)
  const streamRef = useRef<MediaStream | undefined>(undefined)
  const audioRef = useRef<AudioProcessingSession | undefined>(undefined)
  const monitorRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined)
  const runtimeStreamRef = useRef<EventSource | undefined>(undefined)
  const runtimeSyncTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const contextFingerprintRef = useRef<string | undefined>(undefined)
  const contextSyncRef = useRef(Promise.resolve())
  const eventPublishRef = useRef(Promise.resolve())
  const turnRef = useRef<MutableTurn | undefined>(undefined)
  const processedCallsRef = useRef(new Set<string>())

  useEffect(() => () => disconnect(false), [])

  const updateTurn = (turn: MutableTurn | undefined): void => {
    turnRef.current = turn
    setActiveTurn(turn === undefined ? undefined : {
      assistantText: turn.assistantText,
      id: turn.id,
      source: turn.source,
      userText: turn.userText
    })
  }

  const publishTurnEvent = (turnId: string, event: ConversationEventPayload): void => {
    eventPublishRef.current = eventPublishRef.current
      .catch(() => {})
      .then(() => apiRef.current.publishCopilotConversationEvent({
        ...event,
        clientId: clientIdRef.current,
        conversationId: CONVERSATION_ID,
        occurredAt: new Date().toISOString(),
        turnId
      } as CopilotConversationEvent))
      .catch(() => {})
  }

  const connect = async (): Promise<void> => {
    setError(undefined)
    setToolStatus(undefined)
    setStatus('Connecting')
    disconnect(false)
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof WebSocket === 'undefined') {
        throw new Error('This browser does not support Realtime microphone audio.')
      }
      const [token, audioProcessing] = await Promise.all([
        apiRef.current.createCopilotRealtimeToken({
          conversationId: CONVERSATION_ID,
          profileId: 'icarus'
        }),
        apiRef.current.getCopilotAudioProcessing()
      ])
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: inputId ? { deviceId: { exact: inputId } } : true
      })
      streamRef.current = stream
      await discoverDevices()
      const socket = new WebSocket(
        `wss://api.openai.com/v1/realtime?model=${encodeURIComponent(token.model)}`,
        ['realtime', `openai-insecure-api-key.${token.value}`]
      )
      socketRef.current = socket
      socket.onopen = () => {
        void createRealtimeAudioSession(stream, socket, audioProcessing, outputId)
          .then(audio => {
            audioRef.current = audio
            setConnected(true)
            setStatus('Ready · listening')
            startAudioMonitor(audio)
            startRuntimeSync()
            return syncRuntimeContext(socket)
          })
          .catch(cause => fail(cause))
      }
      socket.onmessage = event => {
        try {
          handleRealtimeEvent(JSON.parse(String(event.data)) as unknown, socket)
        } catch (cause) {
          setError(errorMessage(cause))
        }
      }
      socket.onerror = () => setError('The OpenAI Realtime event channel failed.')
      socket.onclose = () => {
        setConnected(false)
        setStatus('Offline')
      }
    } catch (cause) {
      disconnect(false)
      setStatus('Offline')
      setError(errorMessage(cause))
    }
  }

  const disconnect = (updateState = true): void => {
    streamRef.current?.getTracks().forEach(track => track.stop())
    streamRef.current = undefined
    socketRef.current?.close()
    socketRef.current = undefined
    void audioRef.current?.stop().catch(() => {})
    audioRef.current = undefined
    if (monitorRef.current) clearInterval(monitorRef.current)
    monitorRef.current = undefined
    runtimeStreamRef.current?.close()
    runtimeStreamRef.current = undefined
    if (runtimeSyncTimerRef.current) clearTimeout(runtimeSyncTimerRef.current)
    runtimeSyncTimerRef.current = undefined
    contextFingerprintRef.current = undefined
    contextSyncRef.current = Promise.resolve()
    processedCallsRef.current.clear()
    updateTurn(undefined)
    if (updateState) {
      setConnected(false)
      setStatus('Offline')
      setAudioStatus(undefined)
      setToolStatus(undefined)
    }
  }

  const sendText = (candidate: string): void => {
    const text = candidate.trim()
    const socket = socketRef.current
    if (!text || !connected || !socket) throw new Error('Realtime voice is not connected.')
    const turn: MutableTurn = {
      assistantText: '',
      id: `typed-${Date.now()}`,
      source: 'typed',
      userText: text
    }
    updateTurn(turn)
    publishTurnEvent(turn.id, { source: 'realtime', type: 'turn.started', userText: text })
    setToolStatus(undefined)
    setStatus('Thinking')
    sendEvent(socket, {
      item: {
        content: [{ text, type: 'input_text' }],
        role: 'user',
        type: 'message'
      },
      type: 'conversation.item.create'
    })
    requestResponse(socket)
  }

  const handleRealtimeEvent = (candidate: unknown, socket: WebSocket): void => {
    if (!isRecord(candidate) || typeof candidate.type !== 'string') return
    if (candidate.type === 'input_audio_buffer.speech_started') {
      audioRef.current?.playback.clear()
      const id = typeof candidate.item_id === 'string' ? candidate.item_id : `voice-${Date.now()}`
      updateTurn({ assistantText: '', id, source: 'transcribed', userText: '' })
      publishTurnEvent(id, { source: 'realtime', type: 'turn.started', userText: '' })
      setToolStatus(undefined)
      setStatus('Listening')
    } else if (candidate.type === 'input_audio_buffer.speech_stopped') {
      setStatus('Thinking')
      requestResponse(socket)
    } else if (candidate.type === 'conversation.item.input_audio_transcription.completed') {
      const text = typeof candidate.transcript === 'string' ? candidate.transcript : ''
      const turn = turnRef.current ?? {
        assistantText: '',
        id: typeof candidate.item_id === 'string' ? candidate.item_id : `voice-${Date.now()}`,
        source: 'transcribed' as const,
        userText: ''
      }
      turn.userText = text
      updateTurn(turn)
      publishTurnEvent(turn.id, { final: true, text, type: 'user.transcript' })
      void completeTurn()
    } else if (candidate.type === 'response.output_audio.delta') {
      if (typeof candidate.delta === 'string') audioRef.current?.playback.append(candidate.delta)
      setStatus('Speaking')
    } else if (candidate.type === 'response.output_audio_transcript.delta') {
      const turn = turnRef.current
      if (turn && typeof candidate.delta === 'string') {
        turn.assistantText += candidate.delta
        updateTurn(turn)
        publishTurnEvent(turn.id, {
          final: false,
          text: turn.assistantText,
          type: 'assistant.transcript'
        })
      }
      setStatus('Speaking')
    } else if (candidate.type === 'response.output_audio_transcript.done') {
      const turn = turnRef.current
      if (turn && typeof candidate.transcript === 'string') {
        turn.assistantText = candidate.transcript
        updateTurn(turn)
        publishTurnEvent(turn.id, {
          final: true,
          text: turn.assistantText,
          type: 'assistant.transcript'
        })
      }
    } else if (candidate.type === 'response.done') {
      void handleCompletedResponse(isRecord(candidate.response) ? candidate.response : {}, socket)
        .catch(cause => setError(errorMessage(cause)))
    } else if (candidate.type === 'error') {
      const detail = isRecord(candidate.error) && typeof candidate.error.message === 'string'
        ? candidate.error.message
        : 'OpenAI Realtime reported an error.'
      setStatus('Ready · listening')
      setError(detail)
      const turn = turnRef.current
      if (turn) publishTurnEvent(turn.id, { message: detail, type: 'turn.failed' })
    }
  }

  const handleCompletedResponse = async (
    response: Record<string, unknown>,
    socket: WebSocket
  ): Promise<void> => {
    if (response.status === 'failed') throw new Error(realtimeFailure(response))
    if (typeof response.status === 'string' && response.status !== 'completed') {
      setStatus('Ready · listening')
      return
    }
    const output = Array.isArray(response.output) ? response.output.filter(isRecord) : []
    const calls = output.filter(item => (
      item.type === 'function_call' &&
      typeof item.call_id === 'string' &&
      !processedCallsRef.current.has(item.call_id)
    ))
    if (calls.length > 0) {
      setStatus('Acting')
      for (const call of calls) await executeToolCall(call, socket)
      sendEvent(socket, { type: 'response.create' })
      return
    }
    const turn = turnRef.current
    if (turn) {
      const responseText = realtimeResponseText(output)
      if (responseText) turn.assistantText = responseText
      turn.responseDone = true
      updateTurn(turn)
    }
    setStatus('Ready · listening')
    await completeTurn()
  }

  const executeToolCall = async (
    call: Record<string, unknown>,
    socket: WebSocket
  ): Promise<void> => {
    const callId = String(call.call_id)
    const name = String(call.name ?? '')
    processedCallsRef.current.add(callId)
    let arguments_: Record<string, unknown>
    try {
      const parsed = JSON.parse(typeof call.arguments === 'string' ? call.arguments : '{}') as unknown
      arguments_ = isRecord(parsed) ? parsed : {}
    } catch {
      arguments_ = {}
    }
    setToolStatus(`${toolLabel(name)}: working…`)
    const activeTurn = turnRef.current
    if (activeTurn) publishTurnEvent(activeTurn.id, {
      callId,
      name,
      status: 'working',
      type: 'tool.status'
    })
    let result: unknown
    try {
      result = await apiRef.current.executeCopilotRealtimeTool({ arguments: arguments_, name })
      setToolStatus(`${toolLabel(name)}: complete`)
      if (activeTurn) publishTurnEvent(activeTurn.id, { callId, name, status: 'complete', type: 'tool.status' })
    } catch (cause) {
      result = { error: errorMessage(cause) }
      setToolStatus(`${toolLabel(name)}: failed`)
      if (activeTurn) publishTurnEvent(activeTurn.id, { callId, name, status: 'failed', type: 'tool.status' })
    }
    sendEvent(socket, {
      item: { call_id: callId, output: JSON.stringify(result), type: 'function_call_output' },
      type: 'conversation.item.create'
    })
  }

  const requestResponse = (socket: WebSocket): void => {
    const turn = turnRef.current
    if (turn?.responseRequested) return
    if (turn) turn.responseRequested = true
    contextSyncRef.current = contextSyncRef.current
      .catch(() => {})
      .then(() => syncRuntimeContext(socket))
      .then(() => sendEvent(socket, { type: 'response.create' }))
      .catch(cause => {
        if (turn) turn.responseRequested = false
        setStatus('Ready · listening')
        setError(errorMessage(cause))
      })
  }

  const syncRuntimeContext = async (socket: WebSocket): Promise<void> => {
    const context = await apiRef.current.getCopilotRealtimeContext()
    if (context.fingerprint === contextFingerprintRef.current) return
    sendEvent(socket, {
      item: {
        content: [{ text: context.text, type: 'input_text' }],
        role: 'system',
        type: 'message'
      },
      type: 'conversation.item.create'
    })
    contextFingerprintRef.current = context.fingerprint
  }

  const startRuntimeSync = (): void => {
    runtimeStreamRef.current?.close()
    const stream = new EventSource(apiRef.current.runtimeStateStreamUrl())
    runtimeStreamRef.current = stream
    stream.addEventListener('runtime-state', () => {
      if (runtimeSyncTimerRef.current) clearTimeout(runtimeSyncTimerRef.current)
      runtimeSyncTimerRef.current = setTimeout(() => {
        const socket = socketRef.current
        if (socket?.readyState === WebSocket.OPEN) {
          contextSyncRef.current = contextSyncRef.current
            .catch(() => {})
            .then(() => syncRuntimeContext(socket))
            .catch(cause => setError(errorMessage(cause)))
        }
      }, 200)
    })
  }

  const completeTurn = async (): Promise<void> => {
    const turn = turnRef.current
    if (!turn || turn.persisting || !turn.responseDone || !turn.userText.trim() || !turn.assistantText.trim()) return
    turn.persisting = true
    try {
      await eventPublishRef.current
      await apiRef.current.persistCopilotRealtimeTurn({
        assistantText: turn.assistantText,
        clientId: clientIdRef.current,
        conversationId: CONVERSATION_ID,
        source: turn.source,
        turnId: turn.id,
        userText: turn.userText
      })
      updateTurn(undefined)
      setHistoryVersion(version => version + 1)
    } catch (cause) {
      turn.persisting = false
      throw cause
    }
  }

  const discoverDevices = async (): Promise<void> => {
    const available = await navigator.mediaDevices.enumerateDevices()
    const inputs = available.filter(device => device.kind === 'audioinput')
      .map((device, index) => ({ id: device.deviceId, label: device.label || `Microphone ${index + 1}` }))
    const outputs = available.filter(device => device.kind === 'audiooutput')
      .map((device, index) => ({ id: device.deviceId, label: device.label || `Output ${index + 1}` }))
    setDevices({ inputs, outputs })
  }

  const startAudioMonitor = (audio: AudioProcessingSession): void => {
    if (monitorRef.current) clearInterval(monitorRef.current)
    const update = (): void => setAudioStatus(
      `FX active · input ${signalLevel(audio.inputMeter)} · output ${signalLevel(audio.outputMeter)}`
    )
    update()
    monitorRef.current = setInterval(update, 500)
  }

  const fail = (cause: unknown): void => {
    disconnect(false)
    setStatus('Offline')
    setError(errorMessage(cause))
  }

  return (
    <CopilotVoiceContext.Provider value={{
      ...(activeTurn === undefined ? {} : { activeTurn }),
      ...(audioStatus === undefined ? {} : { audioStatus }),
      connect,
      connected,
      devices,
      disconnect: () => disconnect(),
      ...(error === undefined ? {} : { error }),
      historyVersion,
      inputId,
      outputId,
      sendText,
      setInputId,
      setOutputId,
      status,
      ...(toolStatus === undefined ? {} : { toolStatus })
    }}>
      {children}
    </CopilotVoiceContext.Provider>
  )
}

export function useCopilotVoice (): CopilotVoiceState {
  const context = useContext(CopilotVoiceContext)
  if (!context) throw new Error('useCopilotVoice must be used inside CopilotVoiceProvider.')
  return context
}

function sendEvent (socket: WebSocket, event: unknown): void {
  if (socket.readyState !== WebSocket.OPEN) throw new Error('Realtime event channel is not open.')
  socket.send(JSON.stringify(event))
}

function realtimeResponseText (output: readonly Record<string, unknown>[]): string {
  return output.flatMap(item => Array.isArray(item.content) ? item.content.filter(isRecord) : [])
    .map(content => typeof content.transcript === 'string'
      ? content.transcript
      : typeof content.text === 'string' ? content.text : '')
    .join('')
    .trim()
}

function realtimeFailure (response: Record<string, unknown>): string {
  const details = isRecord(response.status_details) ? response.status_details : {}
  const error = isRecord(details.error) ? details.error : {}
  return typeof error.message === 'string' ? error.message : 'The Realtime response failed.'
}

function toolLabel (name: string): string {
  return name.replace(/^phoenix_/u, '').replaceAll('_', ' ')
}

function errorMessage (cause: unknown): string {
  if (cause instanceof DOMException && cause.name === 'NotAllowedError') return 'Microphone permission was denied.'
  if (cause instanceof DOMException && cause.name === 'NotFoundError') return 'No microphone is available.'
  return cause instanceof Error ? cause.message : 'Realtime voice failed.'
}

function isRecord (candidate: unknown): candidate is Record<string, unknown> {
  return typeof candidate === 'object' && candidate !== null && !Array.isArray(candidate)
}
