import {
  ActivityLogResponseSchema,
  CopilotAudioProcessingSchema,
  CopilotConversationEventSchema,
  CopilotProfileSelectionRequestSchema,
  CopilotProfilesResponseSchema,
  CopilotRealtimeTokenRequestSchema,
  CopilotRealtimeTokenResponseSchema,
  CopilotRealtimeToolRequestSchema,
  CopilotRealtimeTurnRequestSchema,
  CopilotVoiceHostCommandAcceptedSchema,
  CopilotVoiceHostHeartbeatSchema,
  CopilotVoiceHostSnapshotSchema,
  GameActionCatalogResponseSchema,
  GameActionResultSchema,
  FleetResponseSchema,
  MacroDefinitionSchema,
  MacroLibrarySchema,
  MacroPlaybackSchema,
  MacroRecordingSchema,
  NavigationRouteSchema,
  PairingStatusSchema,
  PhoenixModulesSchema,
  RuntimeStateSchema,
  ShipCatalogueResponseSchema
} from '@phoenix/contracts'
import type {
  ActivityLogResponse,
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
import type { PhoenixApi } from '../../application/api/phoenix-api.js'

export class PhoenixApiClient implements PhoenixApi {
  readonly #baseUrl: string
  readonly #request: typeof fetch

  constructor(baseUrl = '', request: typeof fetch = globalThis.fetch) {
    this.#baseUrl = baseUrl
    this.#request = request.bind(globalThis)
  }

  async getPairingStatus(signal?: AbortSignal): Promise<PairingStatus> {
    const response = await this.#request(`${this.#baseUrl}/api/pairing/status`, {
      credentials: 'same-origin',
      headers: { accept: 'application/json' },
      signal
    })
    if (!response.ok) throw await apiError(response)
    return PairingStatusSchema.parse(await response.json())
  }

  async claimPairing(code: string, signal?: AbortSignal): Promise<PairingStatus> {
    const response = await this.#request(`${this.#baseUrl}/api/pairing/claim`, {
      body: JSON.stringify({ code }),
      credentials: 'same-origin',
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      method: 'POST',
      signal
    })
    if (!response.ok) throw await apiError(response)
    return PairingStatusSchema.parse(await response.json())
  }

  async getHealth(signal?: AbortSignal): Promise<HealthResponse> {
    const response = await this.#request(`${this.#baseUrl}/api/health`, {
      credentials: 'same-origin',
      headers: { accept: 'application/json' },
      signal
    })
    if (!response.ok) throw await apiError(response)
    return response.json() as Promise<HealthResponse>
  }

  async getRuntimeState(signal?: AbortSignal): Promise<RuntimeState> {
    const response = await this.#request(`${this.#baseUrl}/api/runtime-state`, {
      credentials: 'same-origin',
      headers: { accept: 'application/json' },
      signal
    })
    if (!response.ok) throw await apiError(response)
    return RuntimeStateSchema.parse(await response.json())
  }

  async getFleet(signal?: AbortSignal): Promise<FleetResponse> {
    return this.#get('/api/fleet', FleetResponseSchema, signal)
  }

  async getShipCatalogue(signal?: AbortSignal): Promise<ShipCatalogueResponse> {
    return this.#get('/api/catalogue/ships', ShipCatalogueResponseSchema, signal)
  }

  async getActions(signal?: AbortSignal): Promise<GameActionCatalogResponse> {
    return this.#get('/api/actions', GameActionCatalogResponseSchema, signal)
  }

  async executeAction(
    actionId: string,
    operation: GameActionOperation = 'tap',
    signal?: AbortSignal
  ): Promise<GameActionResult> {
    return this.#json('/api/actions/execute', 'POST', { actionId, operation }, GameActionResultSchema, signal)
  }

  async getActivityLog(limit = 250, signal?: AbortSignal): Promise<ActivityLogResponse> {
    return this.#get(`/api/log?limit=${encodeURIComponent(String(limit))}`, ActivityLogResponseSchema, signal)
  }

  async getNavigationRoute(signal?: AbortSignal): Promise<NavigationRoute> {
    return this.#get('/api/navigation/route', NavigationRouteSchema, signal)
  }

  async getCopilotProfiles(signal?: AbortSignal): Promise<CopilotProfilesResponse> {
    return this.#get('/api/copilot/profiles', CopilotProfilesResponseSchema, signal)
  }

  async selectCopilotProfile(profileId: string, signal?: AbortSignal): Promise<CopilotProfilesResponse> {
    return this.#json('/api/copilot/profiles/active', 'PUT',
      CopilotProfileSelectionRequestSchema.parse({ profileId }), CopilotProfilesResponseSchema, signal)
  }

  async getCopilotAudioProcessing(profileId?: string, signal?: AbortSignal): Promise<CopilotAudioProcessing> {
    const query = profileId ? `?profileId=${encodeURIComponent(profileId)}` : ''
    const response = await this.#request(`${this.#baseUrl}/api/copilot/realtime/audio-processing${query}`, {
      credentials: 'same-origin', headers: { accept: 'application/json' }, signal
    })
    if (!response.ok) throw await apiError(response)
    const payload = await response.json() as { audioProcessing?: unknown }
    return CopilotAudioProcessingSchema.parse(payload.audioProcessing)
  }

  async getCopilotRealtimeContext(signal?: AbortSignal): Promise<{
    fingerprint: string
    text: string
    updatedAt: string | null
  }> {
    const response = await this.#request(`${this.#baseUrl}/api/copilot/realtime/context`, {
      credentials: 'same-origin', headers: { accept: 'application/json' }, signal
    })
    if (!response.ok) throw await apiError(response)
    const payload = await response.json() as Record<string, unknown>
    if (typeof payload.fingerprint !== 'string' || typeof payload.text !== 'string') {
      throw new Error('PHOENIX returned an invalid Realtime context.')
    }
    return {
      fingerprint: payload.fingerprint,
      text: payload.text,
      updatedAt: typeof payload.updatedAt === 'string' ? payload.updatedAt : null
    }
  }

  async createCopilotRealtimeToken(
    input: CopilotRealtimeTokenRequest,
    signal?: AbortSignal
  ): Promise<CopilotRealtimeTokenResponse> {
    return this.#json('/api/copilot/realtime/token', 'POST',
      CopilotRealtimeTokenRequestSchema.parse(input), CopilotRealtimeTokenResponseSchema, signal)
  }

  async executeCopilotRealtimeTool(input: CopilotRealtimeToolRequest, signal?: AbortSignal): Promise<unknown> {
    const response = await this.#request(`${this.#baseUrl}/api/copilot/realtime/tool`, {
      body: JSON.stringify(CopilotRealtimeToolRequestSchema.parse(input)),
      credentials: 'same-origin',
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      method: 'POST', signal
    })
    if (!response.ok) throw await apiError(response)
    return (await response.json() as { result?: unknown }).result
  }

  async persistCopilotRealtimeTurn(input: CopilotRealtimeTurnRequest, signal?: AbortSignal): Promise<void> {
    await this.#empty('/api/copilot/realtime/turn', 'POST', CopilotRealtimeTurnRequestSchema.parse(input), signal)
  }

  async publishCopilotConversationEvent(event: CopilotConversationEvent, signal?: AbortSignal): Promise<void> {
    const validated = CopilotConversationEventSchema.parse(event)
    await this.#empty(
      `/api/copilot/conversations/${encodeURIComponent(validated.conversationId)}/events`,
      'POST',
      validated,
      signal
    )
  }

  async getCopilotVoiceHost(signal?: AbortSignal): Promise<CopilotVoiceHostSnapshot> {
    return this.#get('/api/copilot/voice-host', CopilotVoiceHostSnapshotSchema, signal)
  }

  async updateCopilotVoiceHost(
    input: CopilotVoiceHostHeartbeat,
    signal?: AbortSignal
  ): Promise<CopilotVoiceHostSnapshot> {
    return this.#json('/api/copilot/voice-host', 'PUT',
      CopilotVoiceHostHeartbeatSchema.parse(input), CopilotVoiceHostSnapshotSchema, signal)
  }

  async releaseCopilotVoiceHost(hostId: string, signal?: AbortSignal): Promise<void> {
    await this.#empty(`/api/copilot/voice-host?hostId=${encodeURIComponent(hostId)}`, 'DELETE', undefined, signal)
  }

  async requestCopilotVoiceHostState(
    connected: boolean,
    signal?: AbortSignal
  ): Promise<CopilotVoiceHostCommandAccepted> {
    return this.#json('/api/copilot/voice-host/desired-state', 'POST',
      { connected }, CopilotVoiceHostCommandAcceptedSchema, signal)
  }

  async getMacros(signal?: AbortSignal): Promise<MacroLibrary> {
    return this.#get('/api/macros', MacroLibrarySchema, signal)
  }

  async getModuleSettings(signal?: AbortSignal): Promise<PhoenixModules> {
    return this.#get('/api/settings/modules', PhoenixModulesSchema, signal)
  }

  async saveModuleSettings(settings: PhoenixModules, signal?: AbortSignal): Promise<PhoenixModules> {
    return this.#json('/api/settings/modules', 'PUT', settings, PhoenixModulesSchema, signal)
  }

  async saveMacro(macro: MacroDefinition, signal?: AbortSignal): Promise<MacroDefinition> {
    return this.#json('/api/macros', 'POST', MacroDefinitionSchema.parse(macro), MacroDefinitionSchema, signal)
  }

  async deleteMacro(id: string, signal?: AbortSignal): Promise<void> {
    await this.#empty(`/api/macros/${encodeURIComponent(id)}`, 'DELETE', undefined, signal)
  }

  async startMacroRecording(clientId: string, signal?: AbortSignal): Promise<MacroRecording> {
    return this.#macroRecording('/api/macros/recordings', { clientId }, signal)
  }

  async recordMacroAction(
    recordingId: string,
    clientId: string,
    actionId: string,
    operation: GameActionOperation = 'tap',
    signal?: AbortSignal
  ): Promise<MacroRecording> {
    return this.#macroRecording(`/api/macros/recordings/${encodeURIComponent(recordingId)}/action`, {
      actionId, clientId, operation
    }, signal)
  }

  async stopMacroRecording(
    recordingId: string,
    clientId: string,
    signal?: AbortSignal
  ): Promise<MacroRecording> {
    return this.#macroRecording(
      `/api/macros/recordings/${encodeURIComponent(recordingId)}/stop`, { clientId }, signal
    )
  }

  async cancelMacroRecording(recordingId: string, clientId: string, signal?: AbortSignal): Promise<void> {
    await this.#empty(
      `/api/macros/recordings/${encodeURIComponent(recordingId)}/cancel`, 'POST', { clientId }, signal
    )
  }

  async playMacro(id: string, signal?: AbortSignal): Promise<MacroPlayback> {
    return this.#json(`/api/macros/${encodeURIComponent(id)}/playback`, 'POST', undefined, MacroPlaybackSchema, signal)
  }

  async abortMacroPlayback(signal?: AbortSignal): Promise<MacroPlayback | null> {
    const response = await this.#request(`${this.#baseUrl}/api/macros/playback`, {
      credentials: 'same-origin', headers: { accept: 'application/json' }, method: 'DELETE', signal
    })
    if (!response.ok) throw await apiError(response)
    const payload = await response.json() as { playback?: unknown }
    return payload.playback == null ? null : MacroPlaybackSchema.parse(payload.playback)
  }

  eventStreamUrl(): string {
    return `${this.#baseUrl}/api/events?conversationId=phoenix-copilot`
  }

  async #get<T>(path: string, schema: { parse(value: unknown): T }, signal?: AbortSignal): Promise<T> {
    const response = await this.#request(`${this.#baseUrl}${path}`, {
      credentials: 'same-origin', headers: { accept: 'application/json' }, signal
    })
    if (!response.ok) throw await apiError(response)
    return schema.parse(await response.json())
  }

  async #json<T>(
    path: string,
    method: 'POST' | 'PUT',
    body: unknown,
    schema: { parse(value: unknown): T },
    signal?: AbortSignal
  ): Promise<T> {
    const response = await this.#request(`${this.#baseUrl}${path}`, {
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      credentials: 'same-origin',
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      method,
      signal
    })
    if (!response.ok) throw await apiError(response)
    return schema.parse(await response.json())
  }

  async #empty(
    path: string,
    method: 'DELETE' | 'POST',
    body: unknown,
    signal?: AbortSignal
  ): Promise<void> {
    const response = await this.#request(`${this.#baseUrl}${path}`, {
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      credentials: 'same-origin',
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      method,
      signal
    })
    if (!response.ok) throw await apiError(response)
  }

  #macroRecording(path: string, body: unknown, signal?: AbortSignal): Promise<MacroRecording> {
    return this.#json(path, 'POST', body, MacroRecordingSchema, signal)
  }
}

async function apiError(response: Response): Promise<Error> {
  try {
    const payload = await response.json() as { error?: { message?: unknown } }
    if (typeof payload.error?.message === 'string') return new Error(payload.error.message)
  } catch {
    // Fall back to status evidence when the server did not return the API error envelope.
  }
  return new Error(`PHOENIX API returned HTTP ${response.status}.`)
}
