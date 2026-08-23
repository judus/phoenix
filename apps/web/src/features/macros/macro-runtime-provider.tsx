import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { MacroLibrary, MacroPlayback, MacroRecording } from '@phoenix/contracts'
import type { PhoenixApi } from '../../application/api/phoenix-api.js'
import { createClientId, type ClientIdentity } from '../../application/identity/client-identity.js'
import { macroDefinitionFromRecording } from '../../application/macros/macro-definition.js'
import type { MacroRuntime } from '../../application/macros/macro-runtime.js'
import type { PhoenixRouter } from '../../application/navigation/phoenix-router.js'

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
  const [recording, setRecording] = useState<MacroRecording>()
  const [lastSavedMacroId, setLastSavedMacroId] = useState<string>()
  const [playback, setPlayback] = useState<MacroPlayback>()
  const [error, setError] = useState<string>()
  const clientId = useRef(clientIdentity.forScope('macros'))

  useEffect(() => {
    const abort = new AbortController()
    void api.getMacros(abort.signal)
      .then(result => { if (!abort.signal.aborted) setLibrary(result) })
      .catch(cause => { if (!abort.signal.aborted) setError(message(cause, 'Macro module unavailable.')) })
    return () => abort.abort()
  }, [api])

  const runtime = useMemo<MacroRuntime>(() => ({
    abort: async () => { setPlayback(await api.abortMacroPlayback() ?? undefined) },
    cancelRecording: async () => {
      if (!recording) return
      try {
        await api.cancelMacroRecording(recording.id, clientId.current)
        setRecording(undefined)
        setError(undefined)
        router.push({ kind: 'macros' })
      } catch (cause) { setError(message(cause, 'Unable to cancel recording.')) }
    },
    deleteMacro: async id => {
      try {
        await api.deleteMacro(id)
        setLibrary(await api.getMacros())
        if (lastSavedMacroId === id) setLastSavedMacroId(undefined)
        setError(undefined)
      } catch (cause) { setError(message(cause, 'Unable to delete macro.')) }
    },
    error,
    lastSavedMacroId,
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
    save: async macro => {
      try {
        const saved = await api.saveMacro(macro)
        setLibrary(await api.getMacros())
        setLastSavedMacroId(saved.id)
        setError(undefined)
      } catch (cause) {
        setError(message(cause, 'Unable to save macro.'))
        throw cause
      }
    },
    startRecording: async () => {
      try {
        setRecording(await api.startMacroRecording(clientId.current))
        setError(undefined)
        router.push({ kind: 'controls', category: 'ship' })
      } catch (cause) { setError(message(cause, 'Unable to start recording.')) }
    },
    stopRecording: async () => {
      if (!recording) return
      try {
        const stopped = await api.stopMacroRecording(recording.id, clientId.current)
        setRecording(undefined)
        const macro = macroDefinitionFromRecording(nextMacroName(library), stopped)
        if (macro.steps.length === 0) {
          setError('No usable actions were recorded. The macro was not saved.')
          router.push({ kind: 'macros' })
          return
        }
        const saved = await api.saveMacro(macro)
        setLibrary(await api.getMacros())
        setLastSavedMacroId(saved.id)
        setError(undefined)
        router.push({ kind: 'macros' })
      } catch (cause) { setError(message(cause, 'Unable to stop recording.')) }
    }
  }), [api, error, lastSavedMacroId, library, playback, recording, router])

  return <MacroRuntimeContext.Provider value={runtime}>{children}</MacroRuntimeContext.Provider>
}

export function useMacroRuntime (): MacroRuntime {
  const runtime = useContext(MacroRuntimeContext)
  if (!runtime) throw new Error('Macro runtime is unavailable.')
  return runtime
}

function message (cause: unknown, fallback: string): string {
  return cause instanceof Error ? cause.message : fallback
}

function nextMacroName(library: MacroLibrary): string {
  const names = new Set(library.macros.map(macro => macro.name.toLocaleLowerCase()))
  const ids = new Set(library.macros.map(macro => macro.id))
  let number = 1
  while (names.has(`macro ${number}`) || ids.has(`macro-${number}`)) number += 1
  return `Macro ${number}`
}
