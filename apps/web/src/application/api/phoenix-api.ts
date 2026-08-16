import type {
  CopilotAudioProcessing,
  CopilotConversationEvent,
  CopilotProfilesResponse,
  CopilotRealtimeTokenRequest,
  CopilotRealtimeTokenResponse,
  CopilotRealtimeToolRequest,
  CopilotRealtimeTurnRequest,
  CopilotVoiceHostCommandAccepted,
  CopilotVoiceHostHeartbeat,
  CopilotVoiceHostSnapshot,
  GameActionOperation,
  HealthResponse,
  MacroDefinition,
  MacroLibrary,
  MacroPlayback,
  MacroRecording,
  PairingStatus,
  PhoenixModules,
  RuntimeState
} from '@phoenix/contracts'

export interface PhoenixApi {
  abortMacroPlayback(signal?: AbortSignal): Promise<MacroPlayback | null>
  cancelMacroRecording(recordingId: string, clientId: string, signal?: AbortSignal): Promise<void>
  claimPairing(code: string, signal?: AbortSignal): Promise<PairingStatus>
  createCopilotRealtimeToken(input: CopilotRealtimeTokenRequest, signal?: AbortSignal): Promise<CopilotRealtimeTokenResponse>
  deleteMacro(id: string, signal?: AbortSignal): Promise<void>
  executeCopilotRealtimeTool(input: CopilotRealtimeToolRequest, signal?: AbortSignal): Promise<unknown>
  getCopilotAudioProcessing(profileId?: string, signal?: AbortSignal): Promise<CopilotAudioProcessing>
  getCopilotProfiles(signal?: AbortSignal): Promise<CopilotProfilesResponse>
  getCopilotRealtimeContext(signal?: AbortSignal): Promise<{ fingerprint: string, text: string, updatedAt: string | null }>
  getCopilotVoiceHost(signal?: AbortSignal): Promise<CopilotVoiceHostSnapshot>
  getHealth(signal?: AbortSignal): Promise<HealthResponse>
  getMacros(signal?: AbortSignal): Promise<MacroLibrary>
  getModuleSettings(signal?: AbortSignal): Promise<PhoenixModules>
  getPairingStatus(signal?: AbortSignal): Promise<PairingStatus>
  getRuntimeState(signal?: AbortSignal): Promise<RuntimeState>
  persistCopilotRealtimeTurn(input: CopilotRealtimeTurnRequest, signal?: AbortSignal): Promise<void>
  playMacro(id: string, signal?: AbortSignal): Promise<MacroPlayback>
  publishCopilotConversationEvent(event: CopilotConversationEvent, signal?: AbortSignal): Promise<void>
  recordMacroAction(
    recordingId: string,
    clientId: string,
    actionId: string,
    operation?: GameActionOperation,
    signal?: AbortSignal
  ): Promise<MacroRecording>
  releaseCopilotVoiceHost(hostId: string, signal?: AbortSignal): Promise<void>
  requestCopilotVoiceHostState(connected: boolean, signal?: AbortSignal): Promise<CopilotVoiceHostCommandAccepted>
  saveMacro(macro: MacroDefinition, signal?: AbortSignal): Promise<MacroDefinition>
  saveModuleSettings(settings: PhoenixModules, signal?: AbortSignal): Promise<PhoenixModules>
  selectCopilotProfile(profileId: string, signal?: AbortSignal): Promise<CopilotProfilesResponse>
  startMacroRecording(clientId: string, signal?: AbortSignal): Promise<MacroRecording>
  stopMacroRecording(recordingId: string, clientId: string, signal?: AbortSignal): Promise<MacroRecording>
  updateCopilotVoiceHost(input: CopilotVoiceHostHeartbeat, signal?: AbortSignal): Promise<CopilotVoiceHostSnapshot>
  eventStreamUrl(): string
}
