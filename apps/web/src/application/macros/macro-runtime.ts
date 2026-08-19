import type { MacroDefinition, MacroLibrary, MacroPlayback, MacroRecording } from '@phoenix/contracts'

export interface MacroRuntime {
  abort: () => Promise<void>
  cancelRecording: () => Promise<void>
  deleteMacro: (id: string) => Promise<void>
  draft?: MacroRecording
  error?: string
  library: MacroLibrary
  playback?: MacroPlayback
  play: (macro: MacroDefinition) => Promise<void>
  recordCommand: (commandId: string, operation: MacroRecording['entries'][number]['operation']) => Promise<void>
  recording?: MacroRecording
  save: (name: string) => Promise<void>
  setDraft: (draft: MacroRecording | undefined) => void
  startRecording: () => Promise<void>
  stopRecording: () => Promise<void>
}
