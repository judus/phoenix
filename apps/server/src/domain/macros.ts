import type {
  GameActionOrigin,
  MacroDefinition,
  MacroLibrary,
  MacroPlayback,
  MacroRecording,
  RecordMacroCommandRequest
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
  cancelRecording(recordingId: string, clientId: string): void
  delete(id: string): void
  getLibrary(): MacroLibrary
  getPlayback(): MacroPlayback | null
  recordCommand(recordingId: string, request: RecordMacroCommandRequest): Promise<MacroRecording>
  save(candidate: unknown): MacroDefinition
  startRecording(clientId: string): MacroRecording
  stopRecording(recordingId: string, clientId: string): MacroRecording
}
