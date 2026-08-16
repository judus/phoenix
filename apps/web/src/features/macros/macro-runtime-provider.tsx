import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { MacroDefinition, MacroLibrary, MacroPlayback, MacroRecording, PhoenixModules } from '@phoenix/contracts'
import type { PhoenixApi } from '../../application/api/phoenix-api.js'
import { createClientId, type ClientIdentity } from '../../application/identity/client-identity.js'
import type { PhoenixRouter } from '../../application/navigation/phoenix-router.js'

export interface MacroRuntime {
  cancelRecording: () => Promise<void>
  deleteMacro: (id: string) => Promise<void>
  draft?: MacroRecording
  enabled: boolean
  enable: () => Promise<void>
  error?: string
  library: MacroLibrary
  playback?: MacroPlayback
  play: (macro: MacroDefinition) => Promise<void>
  abort: () => Promise<void>
  recordAction: (actionId: string, operation: MacroRecording['entries'][number]['operation']) => Promise<void>
  recording?: MacroRecording
  save: (name: string) => Promise<void>
  setDraft: (draft: MacroRecording | undefined) => void
  startRecording: () => Promise<void>
  stopRecording: () => Promise<void>
}

const MacroRuntimeContext = createContext<MacroRuntime | undefined>(undefined)

export function MacroRuntimeProvider ({
  api,
  children,
  clientIdentity,
  router
}: {
  api: PhoenixApi
  children: ReactNode
  clientIdentity: ClientIdentity
  router: PhoenixRouter
}) {
  const [library, setLibrary] = useState<MacroLibrary>({ version: 1, macros: [] })
  const [settings, setSettings] = useState<PhoenixModules>()
  const [recording, setRecording] = useState<MacroRecording>()
  const [draft, setDraft] = useState<MacroRecording>()
  const [playback, setPlayback] = useState<MacroPlayback>()
  const [error, setError] = useState<string>()
  const clientId = useRef(clientIdentity.forScope('macros'))

  useEffect(() => {
    void Promise.all([api.getMacros(), api.getModuleSettings()])
      .then(([nextLibrary, nextSettings]) => {
        setLibrary(nextLibrary)
        setSettings(nextSettings)
      })
      .catch(cause => setError(message(cause, 'Macro module unavailable.')))
  }, [api])

  const runtime = useMemo<MacroRuntime>(() => ({
    abort: async () => { setPlayback(await api.abortMacroPlayback() ?? undefined) },
    cancelRecording: async () => {
      if (!recording) return
      try {
        await api.cancelMacroRecording(recording.id, clientId.current)
        setRecording(undefined)
        setDraft(undefined)
        setError(undefined)
        router.push({ kind: 'macros' })
      } catch (cause) { setError(message(cause, 'Unable to cancel recording.')) }
    },
    deleteMacro: async id => {
      try {
        await api.deleteMacro(id)
        setLibrary(await api.getMacros())
        setError(undefined)
      } catch (cause) { setError(message(cause, 'Unable to delete macro.')) }
    },
    draft,
    enabled: settings?.macros.enabled === true,
    enable: async () => {
      if (!settings) return
      try {
        const saved = await api.saveModuleSettings({ ...settings, macros: { ...settings.macros, enabled: true } })
        setSettings(saved)
        setError(undefined)
      } catch (cause) { setError(message(cause, 'Unable to enable macro module.')) }
    },
    error,
    library,
    playback,
    play: async macro => {
      try {
        setPlayback({
          completedSteps: 0,
          macroId: macro.id,
          message: 'Starting macro playback.',
          runId: createClientId(),
          startedAt: new Date().toISOString(),
          status: 'running',
          totalSteps: macro.steps.length
        })
        setPlayback(await api.playMacro(macro.id))
        setError(undefined)
      } catch (cause) {
        setError(message(cause, 'Macro playback failed.'))
        setPlayback(undefined)
      }
    },
    recordAction: async (actionId, operation) => {
      if (!recording) return
      try {
        setRecording(await api.recordMacroAction(recording.id, clientId.current, actionId, operation))
        setError(undefined)
      } catch (cause) {
        setError(message(cause, 'Unable to record macro action.'))
        throw cause
      }
    },
    recording,
    save: async name => {
      if (!draft) return
      try {
        await api.saveMacro(recordingDefinition(name, draft))
        setLibrary(await api.getMacros())
        setDraft(undefined)
        setError(undefined)
      } catch (cause) { setError(message(cause, 'Unable to save macro.')) }
    },
    setDraft,
    startRecording: async () => {
      try {
        setRecording(await api.startMacroRecording(clientId.current))
        setDraft(undefined)
        setError(undefined)
        router.push({ kind: 'controls', category: 'ship' })
      } catch (cause) { setError(message(cause, 'Unable to start recording.')) }
    },
    stopRecording: async () => {
      if (!recording) return
      try {
        setDraft(await api.stopMacroRecording(recording.id, clientId.current))
        setRecording(undefined)
        setError(undefined)
        router.push({ kind: 'macros' })
      } catch (cause) { setError(message(cause, 'Unable to stop recording.')) }
    }
  }), [api, draft, error, library, playback, recording, router, settings])

  return <MacroRuntimeContext.Provider value={runtime}>{children}</MacroRuntimeContext.Provider>
}

export function useMacroRuntime (): MacroRuntime {
  const runtime = useContext(MacroRuntimeContext)
  if (!runtime) throw new Error('Macro runtime is unavailable.')
  return runtime
}

function recordingDefinition (name: string, recording: MacroRecording): MacroDefinition {
  const successful = recording.entries.filter(entry => successfulRecording(entry.status))
  const steps: MacroDefinition['steps'] = []
  successful.forEach((entry, index) => {
    if (index > 0 && entry.delayBeforeMs > 0) steps.push({ type: 'wait', durationMs: Math.min(entry.delayBeforeMs, 30_000) })
    steps.push({ type: 'game-action', actionId: entry.actionId, operation: entry.operation })
  })
  return {
    assumptions: [], description: '', enabled: true, id: macroId(name), name, risk: 'safe', steps, version: 1
  }
}

function successfulRecording (status: MacroRecording['entries'][number]['status']): boolean {
  return ['accepted', 'confirmed', 'unconfirmed', 'already_satisfied'].includes(status)
}

function macroId (name: string): string {
  const normalized = name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/gu, '-').replace(/^-|-$/gu, '')
  return /^[a-z]/u.test(normalized) ? normalized : `macro-${normalized || createClientId().slice(-8)}`
}

function message (cause: unknown, fallback: string): string {
  return cause instanceof Error ? cause.message : fallback
}
