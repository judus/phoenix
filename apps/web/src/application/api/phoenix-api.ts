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
  ActivityLogResponse,
  GameActionCatalogResponse,
  GameActionOperation,
  GameActionResult,
  FleetResponse,
  HealthResponse,
  MacroDefinition,
  MacroLibrary,
  MacroPlayback,
  MacroRecording,
  NavigationRoute,
  PairingStatus,
  PhoenixModules,
  RuntimeState,
  ShipCatalogueResponse
} from '@phoenix/contracts'

export interface PhoenixApi {
  abortMacroPlayback(signal?: AbortSignal): Promise<MacroPlayback | null>
  cancelMacroRecording(recordingId: string, clientId: string, signal?: AbortSignal): Promise<void>
  claimPairing(code: string, signal?: AbortSignal): Promise<PairingStatus>
  createCopilotRealtimeToken(input: CopilotRealtimeTokenRequest, signal?: AbortSignal): Promise<CopilotRealtimeTokenResponse>
  deleteMacro(id: string, signal?: AbortSignal): Promise<void>
  executeCopilotRealtimeTool(input: CopilotRealtimeToolRequest, signal?: AbortSignal): Promise<unknown>
  executeAction(actionId: string, operation?: GameActionOperation, signal?: AbortSignal): Promise<GameActionResult>
  getActions(signal?: AbortSignal): Promise<GameActionCatalogResponse>
  getActivityLog(limit?: number, signal?: AbortSignal): Promise<ActivityLogResponse>
  getCopilotAudioProcessing(profileId?: string, signal?: AbortSignal): Promise<CopilotAudioProcessing>
  getCopilotProfiles(signal?: AbortSignal): Promise<CopilotProfilesResponse>
  getCopilotRealtimeContext(signal?: AbortSignal): Promise<{ fingerprint: string, text: string, updatedAt: string | null }>
  getCopilotVoiceHost(signal?: AbortSignal): Promise<CopilotVoiceHostSnapshot>
  getFleet(signal?: AbortSignal): Promise<FleetResponse>
  getHealth(signal?: AbortSignal): Promise<HealthResponse>
  getMacros(signal?: AbortSignal): Promise<MacroLibrary>
  getModuleSettings(signal?: AbortSignal): Promise<PhoenixModules>
  getNavigationRoute(signal?: AbortSignal): Promise<NavigationRoute>
  getPairingStatus(signal?: AbortSignal): Promise<PairingStatus>
  getRuntimeState(signal?: AbortSignal): Promise<RuntimeState>
  getShipCatalogue(signal?: AbortSignal): Promise<ShipCatalogueResponse>
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
