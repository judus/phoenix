import type {
  GameActionOrigin,
  MacroDefinition,
  MacroLibrary,
  MacroPlayback,
  MacroRecording,
  RecordMacroActionRequest
} from '@phoenix/contracts'

export interface MacroRepository {
  delete(id: string): void
  get(id: string): MacroDefinition | undefined
  getLibrary(): MacroLibrary
  save(definition: MacroDefinition): MacroDefinition
}

export interface MacroCommandExecutor {
  execute(macroId: string, origin: GameActionOrigin, signal?: AbortSignal): Promise<MacroPlayback>
}

export interface Macros extends MacroCommandExecutor {
  abortPlayback(): MacroPlayback | null
  cancelRecording(recordingId: string, clientId: string): Promise<void>
  delete(id: string): void
  getLibrary(): MacroLibrary
  getPlayback(): MacroPlayback | null
  recordAction(recordingId: string, request: RecordMacroActionRequest): Promise<MacroRecording>
  save(candidate: unknown): MacroDefinition
  startRecording(clientId: string): MacroRecording
  stopRecording(recordingId: string, clientId: string): Promise<MacroRecording>
}
