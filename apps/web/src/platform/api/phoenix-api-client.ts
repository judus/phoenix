import {
  ActivityLogResponseSchema,
  CartographyLookupResponseSchema,
  CommunicationsResponseSchema,
  CopilotAudioProcessingSchema,
  CopilotChatRequestSchema,
  CopilotConversationEventSchema,
  CopilotHistoryResponseSchema,
  CopilotProfileDocumentSchema,
  CopilotProfileSelectionRequestSchema,
  CopilotProfileWriteRequestSchema,
  CopilotProfilesResponseSchema,
  CopilotRealtimeTokenRequestSchema,
  CopilotRealtimeTokenResponseSchema,
  CopilotRealtimeToolRequestSchema,
  CopilotRealtimeTurnRequestSchema,
  CopilotVoiceHostCommandAcceptedSchema,
  CopilotVoiceHostHeartbeatSchema,
  CopilotVoiceHostSnapshotSchema,
  ControlGridLayoutSchema,
  CommandCatalogResponseSchema,
  GameActionCatalogResponseSchema,
  GameActionResultSchema,
  GalnetNewsResponseSchema,
  FleetResponseSchema,
  EngineeringBlueprintDetailSchema,
  EngineeringBlueprintsResponseSchema,
  EngineeringEngineersResponseSchema,
  EngineeringMaterialsResponseSchema,
  GalaxyFilteredSystemsResponseSchema,
  GalaxyCommodityMarketsResponseSchema,
  GalaxyExplorationTargetsResponseSchema,
  GalaxyFactionPresencesResponseSchema,
  GalaxyNearbySystemsResponseSchema,
  GalaxyNearestStationsResponseSchema,
  GalaxyOutfittingResponseSchema,
  GalaxyShipyardsResponseSchema,
  GalaxyStationLookupResponseSchema,
  GalaxyTradeOpportunitiesResponseSchema,
  InstallationSettingsSchema,
  InstallationSettingsUpdateSchema,
  MacroDefinitionSchema,
  MacroLibrarySchema,
  MacroPlaybackSchema,
  MacroRecordingSchema,
  MissionsResponseSchema,
  NavigationRouteSchema,
  NumpadExecutionResultSchema,
  NumpadTreeSnapshotSchema,
  PairingStatusSchema,
  OpenAiApiKeyRequestSchema,
  OpenAiConfigurationStatusSchema,
  PhoenixModulesSchema,
  RuntimeStateSchema,
  ShipCatalogueResponseSchema
} from '@phoenix/contracts'
import {
  ControlDeckCommandCatalogueSchema,
  ControlDeckCommandExecutionResultSchema,
  ControlDeckConfigurationSchema,
  type ControlDeckCommandCatalogue,
  type ControlDeckCommandExecutionResult,
  type ControlDeckCommandOperation,
  type ControlDeckCommandTarget,
  type ControlDeckConfiguration
} from '@jdu/control-deck-core'
import type {
  ActivityLogResponse,
  CartographyLookupResponse,
  CommunicationsResponse,
  CopilotAudioProcessing,
  CopilotChatRequest,
  CopilotConversationEvent,
  CopilotHistoryResponse,
  CopilotProfileDocument,
  CopilotProfileWriteRequest,
  CopilotProfilesResponse,
  CopilotRealtimeTokenRequest,
  CopilotRealtimeTokenResponse,
  CopilotRealtimeToolRequest,
  CopilotRealtimeTurnRequest,
  CopilotVoiceHostCommandAccepted,
  CopilotVoiceHostHeartbeat,
  CopilotVoiceHostSnapshot,
  ControlGridLayout,
  CommandCatalogResponse,
  GameActionCatalogResponse,
  GameActionOperation,
  GameActionResult,
  GalnetNewsResponse,
  FleetResponse,
  EngineeringBlueprintDetail,
  EngineeringBlueprintsResponse,
  EngineeringEngineersResponse,
  EngineeringMaterial,
  EngineeringMaterialsResponse,
  GalaxyFilteredSystemsResponse,
  GalaxyCommodityMarketsResponse,
  GalaxyExplorationTargetsResponse,
  GalaxyFactionPresencesResponse,
  GalaxyNearbySystemsResponse,
  GalaxyNearestStationsResponse,
  GalaxyOutfittingResponse,
  GalaxyShipyardsResponse,
  GalaxyStationLookupResponse,
  GalaxyTradeOpportunitiesResponse,
  HealthResponse,
  InstallationSettings,
  InstallationSettingsUpdate,
  MacroDefinition,
  MacroLibrary,
  MacroPlayback,
  MacroRecording,
  MissionsResponse,
  NavigationRoute,
  NumpadExecutionResult,
  NumpadTreeSnapshot,
  PairingStatus,
  OpenAiConfigurationStatus,
  PhoenixModules,
  RuntimeState,
  ShipCatalogueResponse
} from '@phoenix/contracts'
import type {
  FilteredSystemsQuery,
  GalaxyCommodityMarketSearch,
  GalaxyExplorationTargetSearch,
  GalaxyFactionPresenceSearch,
  GalaxyNearbySystemSearch,
  GalaxyNearestStationSearch,
  GalaxyOutfittingSearch,
  GalaxyShipyardSearch,
  GalaxyStationLookupSearch,
  GalaxyTradeOpportunitySearch,
  PhoenixApi,
  CopilotStreamEvent
} from '../../application/api/phoenix-api.js'

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

  async releasePairing(signal?: AbortSignal): Promise<void> {
    await this.#empty('/api/pairing/release', 'POST', undefined, signal)
  }

  async getInstallationSettings(signal?: AbortSignal): Promise<InstallationSettings> {
    return this.#get('/api/settings', InstallationSettingsSchema, signal)
  }

  async saveInstallationSettings(
    settings: InstallationSettingsUpdate,
    signal?: AbortSignal
  ): Promise<InstallationSettings> {
    return this.#json('/api/settings', 'PUT', InstallationSettingsUpdateSchema.parse(settings), InstallationSettingsSchema, signal)
  }

  async saveOpenAiApiKey(apiKey: string, signal?: AbortSignal): Promise<OpenAiConfigurationStatus> {
    return this.#json('/api/settings/openai-key', 'PUT', OpenAiApiKeyRequestSchema.parse({ apiKey }), OpenAiConfigurationStatusSchema, signal)
  }

  async removeOpenAiApiKey(signal?: AbortSignal): Promise<OpenAiConfigurationStatus> {
    return this.#json('/api/settings/openai-key', 'DELETE', undefined, OpenAiConfigurationStatusSchema, signal)
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

  async getMissions(signal?: AbortSignal): Promise<MissionsResponse> {
    return this.#get('/api/operations/missions', MissionsResponseSchema, signal)
  }

  async getEngineeringEngineers(signal?: AbortSignal): Promise<EngineeringEngineersResponse> {
    return this.#get('/api/engineering/engineers', EngineeringEngineersResponseSchema, signal)
  }

  async getEngineeringMaterials(category: EngineeringMaterial['category'], signal?: AbortSignal): Promise<EngineeringMaterialsResponse> {
    return this.#get(`/api/engineering/materials?category=${encodeURIComponent(category)}`, EngineeringMaterialsResponseSchema, signal)
  }

  async getEngineeringBlueprints(signal?: AbortSignal): Promise<EngineeringBlueprintsResponse> {
    return this.#get('/api/engineering/blueprints', EngineeringBlueprintsResponseSchema, signal)
  }

  async getEngineeringBlueprint(symbol: string, signal?: AbortSignal): Promise<EngineeringBlueprintDetail> {
    return this.#get(`/api/engineering/blueprints/${encodeURIComponent(symbol)}`, EngineeringBlueprintDetailSchema, signal)
  }

  async getCommunications(
    view: 'all' | 'inbox' | 'traffic' = 'all',
    limit = 500,
    signal?: AbortSignal
  ): Promise<CommunicationsResponse> {
    return this.#get(`/api/comms/messages?${new URLSearchParams({ limit: String(limit), view })}`, CommunicationsResponseSchema, signal)
  }

  async getGalnetNews(limit = 40, signal?: AbortSignal): Promise<GalnetNewsResponse> {
    return this.#get(`/api/galnet?limit=${encodeURIComponent(String(limit))}`, GalnetNewsResponseSchema, signal)
  }

  async getShipCatalogue(signal?: AbortSignal): Promise<ShipCatalogueResponse> {
    return this.#get('/api/catalogue/ships', ShipCatalogueResponseSchema, signal)
  }

  async getActions(signal?: AbortSignal): Promise<GameActionCatalogResponse> {
    return this.#get('/api/actions', GameActionCatalogResponseSchema, signal)
  }

  async getCommands(signal?: AbortSignal): Promise<CommandCatalogResponse> {
    return this.#get('/api/commands', CommandCatalogResponseSchema, signal)
  }

  async getNumpadSnapshot(signal?: AbortSignal): Promise<NumpadTreeSnapshot> {
    return this.#get('/api/numpad', NumpadTreeSnapshotSchema, signal)
  }

  async executeNumpadAddress(address: string, revision: number, signal?: AbortSignal): Promise<NumpadExecutionResult> {
    return this.#json('/api/numpad/execute', 'POST', { address, revision }, NumpadExecutionResultSchema, signal)
  }

  async getControlDeckCommands(signal?: AbortSignal): Promise<ControlDeckCommandCatalogue> {
    return this.#get('/api/control-deck/commands', ControlDeckCommandCatalogueSchema, signal)
  }

  async getControlDeckConfiguration(signal?: AbortSignal): Promise<ControlDeckConfiguration> {
    return this.#get('/api/control-deck/configuration', ControlDeckConfigurationSchema, signal)
  }

  async saveControlDeckConfiguration(configuration: ControlDeckConfiguration, signal?: AbortSignal): Promise<ControlDeckConfiguration> {
    return this.#json('/api/control-deck/configuration', 'PUT', ControlDeckConfigurationSchema.parse(configuration), ControlDeckConfigurationSchema, signal)
  }

  async executeControlDeckCommand(
    target: ControlDeckCommandTarget,
    operation: ControlDeckCommandOperation,
    leaseId?: string,
    signal?: AbortSignal
  ): Promise<ControlDeckCommandExecutionResult> {
    return this.#json(
      '/api/control-deck/commands/execute',
      'POST',
      { target, operation, ...(leaseId ? { leaseId } : {}) },
      ControlDeckCommandExecutionResultSchema,
      signal
    )
  }

  async getControlLayout(signal?: AbortSignal): Promise<ControlGridLayout> {
    return this.#get('/api/control-layout', ControlGridLayoutSchema, signal)
  }

  async saveControlLayout(layout: ControlGridLayout, signal?: AbortSignal): Promise<ControlGridLayout> {
    return this.#json('/api/control-layout', 'PUT', layout, ControlGridLayoutSchema, signal)
  }

  async executeAction(
    actionId: string,
    operation: GameActionOperation = 'tap',
    options: { leaseId?: string, signal?: AbortSignal } = {}
  ): Promise<GameActionResult> {
    return this.#json(
      '/api/actions/execute',
      'POST',
      { actionId, operation, ...(options.leaseId ? { leaseId: options.leaseId } : {}) },
      GameActionResultSchema,
      options.signal
    )
  }

  async getActivityLog(limit = 250, signal?: AbortSignal): Promise<ActivityLogResponse> {
    return this.#get(`/api/log?limit=${encodeURIComponent(String(limit))}`, ActivityLogResponseSchema, signal)
  }

  async getNavigationRoute(signal?: AbortSignal): Promise<NavigationRoute> {
    return this.#get('/api/navigation/route', NavigationRouteSchema, signal)
  }

  async getSystemCartography(systemName?: string, signal?: AbortSignal): Promise<CartographyLookupResponse> {
    const query = systemName?.trim() ? `?name=${encodeURIComponent(systemName.trim())}` : ''
    return this.#get(`/api/navigation/system${query}`, CartographyLookupResponseSchema, signal)
  }

  async getFilteredSystems(input: FilteredSystemsQuery, signal?: AbortSignal): Promise<GalaxyFilteredSystemsResponse> {
    const query = new URLSearchParams({
      maxDistance: String(input.maxDistance),
      population: input.population,
      system: input.system
    })
    for (const key of ['allegiance', 'economy', 'government', 'security'] as const) {
      if (input[key]) query.set(key, input[key])
    }
    if (input.minPopulation !== undefined) query.set('minPopulation', String(input.minPopulation))
    if (input.maxPopulation !== undefined) query.set('maxPopulation', String(input.maxPopulation))
    return this.#get(`/api/galaxy/systems/search?${query}`, GalaxyFilteredSystemsResponseSchema, signal)
  }

  async findGalaxyNearestStations(input: GalaxyNearestStationSearch, signal?: AbortSignal): Promise<GalaxyNearestStationsResponse> {
    const query = parameters({ pad: input.minimumPadSize, service: input.service, system: input.systemName })
    return this.#get(`/api/galaxy/nearest?${query}`, GalaxyNearestStationsResponseSchema, signal)
  }

  async findGalaxyNearbySystems(input: GalaxyNearbySystemSearch, signal?: AbortSignal): Promise<GalaxyNearbySystemsResponse> {
    const query = parameters({ limit: input.limit, maxDistance: input.maxDistance, system: input.systemName })
    return this.#get(`/api/galaxy/systems?${query}`, GalaxyNearbySystemsResponseSchema, signal)
  }

  async findGalaxyExplorationTargets(input: GalaxyExplorationTargetSearch, signal?: AbortSignal): Promise<GalaxyExplorationTargetsResponse> {
    const { systemName, ...filters } = input
    return this.#get(`/api/galaxy/exploration-targets?${parameters({ ...filters, system: systemName })}`, GalaxyExplorationTargetsResponseSchema, signal)
  }

  async findGalaxyFactionPresences(input: GalaxyFactionPresenceSearch, signal?: AbortSignal): Promise<GalaxyFactionPresencesResponse> {
    const query = parameters({ allegiance: input.allegiance, controlling: input.controlling, faction: input.factionName, government: input.government, limit: input.limit, maxDistance: input.maxDistance, minInfluence: input.minInfluence, state: input.state, system: input.systemName })
    return this.#get(`/api/galaxy/factions/search?${query}`, GalaxyFactionPresencesResponseSchema, signal)
  }

  async findGalaxyShipyards(input: GalaxyShipyardSearch, signal?: AbortSignal): Promise<GalaxyShipyardsResponse> {
    return this.#get(`/api/galaxy/shipyards?${parameters({ hull: input.hullName, limit: input.limit, system: input.systemName })}`, GalaxyShipyardsResponseSchema, signal)
  }

  async findGalaxyOutfitting(input: GalaxyOutfittingSearch, signal?: AbortSignal): Promise<GalaxyOutfittingResponse> {
    const query = parameters({ limit: input.limit, maxDaysAgo: input.maxDaysAgo, maxDistance: input.maxDistance, module: input.module, pad: input.minimumPadSize, system: input.systemName })
    return this.#get(`/api/galaxy/outfitting?${query}`, GalaxyOutfittingResponseSchema, signal)
  }

  async findGalaxyStations(input: GalaxyStationLookupSearch, signal?: AbortSignal): Promise<GalaxyStationLookupResponse> {
    const query = parameters({ limit: input.limit, maxDistance: input.maxDistance, name: input.name, pad: input.minimumPadSize, system: input.systemName, type: input.stationType })
    return this.#get(`/api/galaxy/stations?${query}`, GalaxyStationLookupResponseSchema, signal)
  }

  async findGalaxyCommodityMarkets(input: GalaxyCommodityMarketSearch, signal?: AbortSignal): Promise<GalaxyCommodityMarketsResponse> {
    const query = parameters({ commodity: input.commodity, fleetCarriers: input.fleetCarriers, intent: input.intent, maxDaysAgo: input.maxDaysAgo, maxDistance: input.maxDistance, minVolume: input.minVolume, system: input.systemName })
    return this.#get(`/api/galaxy/markets?${query}`, GalaxyCommodityMarketsResponseSchema, signal)
  }

  async findGalaxyTradeOpportunities(input: GalaxyTradeOpportunitySearch, signal?: AbortSignal): Promise<GalaxyTradeOpportunitiesResponse> {
    const query = parameters({ availableCredits: input.availableCredits, cargoCapacity: input.cargoCapacity, fleetCarriers: input.fleetCarriers, limit: input.limit, maxDaysAgo: input.maxDaysAgo, maxDistance: input.maxDistance, minVolume: input.minVolume, system: input.systemName })
    return this.#get(`/api/galaxy/trade-opportunities?${query}`, GalaxyTradeOpportunitiesResponseSchema, signal)
  }

  async getCopilotProfiles(signal?: AbortSignal): Promise<CopilotProfilesResponse> {
    return this.#get('/api/copilot/profiles', CopilotProfilesResponseSchema, signal)
  }

  async getCopilotHistory(conversationId: string, signal?: AbortSignal): Promise<CopilotHistoryResponse> {
    return this.#get(`/api/copilot/conversations/${encodeURIComponent(conversationId)}`, CopilotHistoryResponseSchema, signal)
  }

  async getCopilotProfile(profileId: string, signal?: AbortSignal): Promise<CopilotProfileDocument> {
    return this.#get(`/api/copilot/profiles/${encodeURIComponent(profileId)}`, CopilotProfileDocumentSchema, signal)
  }

  async createCopilotProfile(input: CopilotProfileWriteRequest, signal?: AbortSignal): Promise<CopilotProfileDocument> {
    return this.#json('/api/copilot/profiles', 'POST', CopilotProfileWriteRequestSchema.parse(input), CopilotProfileDocumentSchema, signal)
  }

  async updateCopilotProfile(profileId: string, input: CopilotProfileWriteRequest, signal?: AbortSignal): Promise<CopilotProfileDocument> {
    return this.#json(`/api/copilot/profiles/${encodeURIComponent(profileId)}`, 'PUT', CopilotProfileWriteRequestSchema.parse(input), CopilotProfileDocumentSchema, signal)
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

  async streamCopilotMessage(input: CopilotChatRequest, onEvent: (event: CopilotStreamEvent) => void, signal?: AbortSignal): Promise<void> {
    const response = await this.#request(`${this.#baseUrl}/api/copilot/chat`, {
      body: JSON.stringify(CopilotChatRequestSchema.parse(input)),
      credentials: 'same-origin',
      headers: { accept: 'text/event-stream', 'content-type': 'application/json' },
      method: 'POST',
      signal
    })
    if (!response.ok) throw await apiError(response)
    if (!response.body) throw new Error('PHOENIX Copilot stream has no response body.')
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffered = ''
    while (true) {
      const result = await reader.read()
      buffered += decoder.decode(result.value, { stream: !result.done })
      let boundary = buffered.indexOf('\n\n')
      while (boundary >= 0) {
        const event = parseCopilotStreamFrame(buffered.slice(0, boundary))
        buffered = buffered.slice(boundary + 2)
        if (event) onEvent(event)
        boundary = buffered.indexOf('\n\n')
      }
      if (result.done) break
    }
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
    method: 'DELETE' | 'POST' | 'PUT',
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

function parameters(values: Record<string, boolean | number | string | undefined>): URLSearchParams {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== '') query.set(key, String(value))
  }
  return query
}

function parseCopilotStreamFrame(frame: string): CopilotStreamEvent | undefined {
  if (!frame || frame.startsWith(':')) return undefined
  const lines = frame.split('\n')
  const type = lines.find(line => line.startsWith('event: '))?.slice(7)
  const serialized = lines.filter(line => line.startsWith('data: ')).map(line => line.slice(6)).join('\n')
  if (!type || !serialized) return undefined
  const payload = JSON.parse(serialized) as unknown
  if (!isRecord(payload)) throw new Error(`Invalid PHOENIX Copilot ${type} event.`)
  switch (type) {
    case 'started': return { type, conversationId: stringField(payload, 'conversationId') }
    case 'retrying': return { type, attempt: numberField(payload, 'attempt') }
    case 'reset': return { type }
    case 'delta': return { type, delta: stringField(payload, 'delta') }
    case 'tool': return { type, callId: stringField(payload, 'callId'), ...(payload.name === undefined ? {} : { name: stringField(payload, 'name') }), status: stringField(payload, 'status') }
    case 'completed': return { type, conversationId: stringField(payload, 'conversationId'), text: stringField(payload, 'text') }
    case 'error': throw new Error(isRecord(payload.error) && typeof payload.error.message === 'string' ? payload.error.message : 'Copilot stream failed.')
    default: return undefined
  }
}

function isRecord(candidate: unknown): candidate is Record<string, unknown> { return typeof candidate === 'object' && candidate !== null && !Array.isArray(candidate) }
function stringField(record: Record<string, unknown>, key: string): string { const value = record[key]; if (typeof value !== 'string') throw new Error(`Copilot event field ${key} must be a string.`); return value }
function numberField(record: Record<string, unknown>, key: string): number { const value = record[key]; if (typeof value !== 'number') throw new Error(`Copilot event field ${key} must be a number.`); return value }

async function apiError(response: Response): Promise<Error> {
  try {
    const payload = await response.json() as { error?: { message?: unknown } }
    if (typeof payload.error?.message === 'string') return new Error(payload.error.message)
  } catch {
    // Fall back to status evidence when the server did not return the API error envelope.
  }
  return new Error(`PHOENIX API returned HTTP ${response.status}.`)
}
