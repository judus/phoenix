import type { MacroDefinition, MacroLibrary, MacroPlayback, MacroRecording } from '@phoenix/contracts'

export interface MacroRuntime {
  abort: () => Promise<void>
  cancelRecording: () => Promise<void>
  deleteMacro: (id: string) => Promise<void>
  error?: string
  lastSavedMacroId?: string
  library: MacroLibrary
  playback?: MacroPlayback
  play: (macro: MacroDefinition) => Promise<void>
  recordAction: (actionId: string, operation: MacroRecording['entries'][number]['operation']) => Promise<void>
  recording?: MacroRecording
  save: (macro: MacroDefinition) => Promise<void>
  startRecording: () => Promise<void>
  stopRecording: () => Promise<void>
}
