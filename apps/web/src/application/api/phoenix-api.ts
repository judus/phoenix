import type {
  CopilotChatRequest,
  CopilotAudioProcessing,
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
  ActivityLogResponse,
  CartographyLookupResponse,
  CommunicationsResponse,
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
  MacroDefinition,
  MacroLibrary,
  MacroPlayback,
  MacroRecording,
  MissionsResponse,
  NavigationRoute,
  NumpadExecutionResult,
  NumpadTreeSnapshot,
  PairingStatus,
  PhoenixModules,
  RuntimeState,
  ShipCatalogueResponse
} from '@phoenix/contracts'

export type CopilotStreamEvent =
  | { type: 'started', conversationId: string }
  | { type: 'retrying', attempt: number }
  | { type: 'reset' }
  | { type: 'delta', delta: string }
  | { type: 'tool', callId: string, name?: string, status: string }
  | { type: 'completed', conversationId: string, text: string }

export interface FilteredSystemsQuery {
  allegiance?: string
  economy?: string
  government?: string
  maxDistance: number
  maxPopulation?: number
  minPopulation?: number
  population: 'any' | 'inhabited' | 'uninhabited'
  security?: string
  system: string
}

export interface GalaxyNearbySystemSearch { limit?: number, maxDistance?: number, systemName: string }
export interface GalaxyNearestStationSearch { minimumPadSize?: PadSize, service: string, systemName: string }
export interface GalaxyShipyardSearch { hullName: string, limit?: number, systemName: string }
export interface GalaxyOutfittingSearch { limit?: number, maxDaysAgo?: number, maxDistance?: number, minimumPadSize?: PadSize, module: string, systemName: string }
export interface GalaxyStationLookupSearch { limit?: number, maxDistance?: number, minimumPadSize?: PadSize, name: string, stationType?: 'any' | 'carrier' | 'orbital' | 'surface', systemName: string }
export interface GalaxyCommodityMarketSearch { commodity: string, fleetCarriers?: boolean, intent: 'buy' | 'sell', maxDaysAgo?: number, maxDistance?: number, minVolume?: number, systemName: string }
export interface GalaxyTradeOpportunitySearch { availableCredits: number, cargoCapacity: number, fleetCarriers?: boolean, limit?: number, maxDaysAgo?: number, maxDistance?: number, minVolume?: number, systemName: string }
export interface GalaxyFactionPresenceSearch { allegiance?: string, controlling?: 'any' | 'yes' | 'no', factionName: string, government?: string, limit?: number, maxDistance?: number, minInfluence?: number, state?: string, systemName: string }
export interface GalaxyExplorationTargetSearch { atmosphere?: string, bodyType?: string, landable?: 'any' | 'yes' | 'no', limit?: number, maxDistance?: number, maxGravityG?: number, maxTemperatureK?: number, minBiologicalSignals?: number, minGeologicalSignals?: number, minGravityG?: number, minTemperatureK?: number, systemName: string, volcanism?: string }
type PadSize = 'small' | 'medium' | 'large'

export interface PhoenixApi {
  abortMacroPlayback(signal?: AbortSignal): Promise<MacroPlayback | null>
  cancelMacroRecording(recordingId: string, clientId: string, signal?: AbortSignal): Promise<void>
  claimPairing(code: string, signal?: AbortSignal): Promise<PairingStatus>
  createCopilotProfile(input: CopilotProfileWriteRequest, signal?: AbortSignal): Promise<CopilotProfileDocument>
  createCopilotRealtimeToken(input: CopilotRealtimeTokenRequest, signal?: AbortSignal): Promise<CopilotRealtimeTokenResponse>
  deleteMacro(id: string, signal?: AbortSignal): Promise<void>
  executeCopilotRealtimeTool(input: CopilotRealtimeToolRequest, signal?: AbortSignal): Promise<unknown>
  executeAction(actionId: string, operation?: GameActionOperation, signal?: AbortSignal): Promise<GameActionResult>
  executeNumpadAddress(address: string, revision: number, signal?: AbortSignal): Promise<NumpadExecutionResult>
  getEngineeringBlueprint(symbol: string, signal?: AbortSignal): Promise<EngineeringBlueprintDetail>
  getEngineeringBlueprints(signal?: AbortSignal): Promise<EngineeringBlueprintsResponse>
  getEngineeringEngineers(signal?: AbortSignal): Promise<EngineeringEngineersResponse>
  getEngineeringMaterials(category: EngineeringMaterial['category'], signal?: AbortSignal): Promise<EngineeringMaterialsResponse>
  getActions(signal?: AbortSignal): Promise<GameActionCatalogResponse>
  getActivityLog(limit?: number, signal?: AbortSignal): Promise<ActivityLogResponse>
  getCopilotAudioProcessing(profileId?: string, signal?: AbortSignal): Promise<CopilotAudioProcessing>
  getCopilotHistory(conversationId: string, signal?: AbortSignal): Promise<CopilotHistoryResponse>
  getCopilotProfile(profileId: string, signal?: AbortSignal): Promise<CopilotProfileDocument>
  getCopilotProfiles(signal?: AbortSignal): Promise<CopilotProfilesResponse>
  getCopilotRealtimeContext(signal?: AbortSignal): Promise<{ fingerprint: string, text: string, updatedAt: string | null }>
  getCopilotVoiceHost(signal?: AbortSignal): Promise<CopilotVoiceHostSnapshot>
  getCommunications(view?: 'all' | 'inbox' | 'traffic', limit?: number, signal?: AbortSignal): Promise<CommunicationsResponse>
  getControlLayout(signal?: AbortSignal): Promise<ControlGridLayout>
  getCommands(signal?: AbortSignal): Promise<CommandCatalogResponse>
  getFleet(signal?: AbortSignal): Promise<FleetResponse>
  getGalnetNews(limit?: number, signal?: AbortSignal): Promise<GalnetNewsResponse>
  getFilteredSystems(input: FilteredSystemsQuery, signal?: AbortSignal): Promise<GalaxyFilteredSystemsResponse>
  findGalaxyCommodityMarkets(input: GalaxyCommodityMarketSearch, signal?: AbortSignal): Promise<GalaxyCommodityMarketsResponse>
  findGalaxyExplorationTargets(input: GalaxyExplorationTargetSearch, signal?: AbortSignal): Promise<GalaxyExplorationTargetsResponse>
  findGalaxyFactionPresences(input: GalaxyFactionPresenceSearch, signal?: AbortSignal): Promise<GalaxyFactionPresencesResponse>
  findGalaxyNearbySystems(input: GalaxyNearbySystemSearch, signal?: AbortSignal): Promise<GalaxyNearbySystemsResponse>
  findGalaxyNearestStations(input: GalaxyNearestStationSearch, signal?: AbortSignal): Promise<GalaxyNearestStationsResponse>
  findGalaxyOutfitting(input: GalaxyOutfittingSearch, signal?: AbortSignal): Promise<GalaxyOutfittingResponse>
  findGalaxyShipyards(input: GalaxyShipyardSearch, signal?: AbortSignal): Promise<GalaxyShipyardsResponse>
  findGalaxyStations(input: GalaxyStationLookupSearch, signal?: AbortSignal): Promise<GalaxyStationLookupResponse>
  findGalaxyTradeOpportunities(input: GalaxyTradeOpportunitySearch, signal?: AbortSignal): Promise<GalaxyTradeOpportunitiesResponse>
  getHealth(signal?: AbortSignal): Promise<HealthResponse>
  getMacros(signal?: AbortSignal): Promise<MacroLibrary>
  getMissions(signal?: AbortSignal): Promise<MissionsResponse>
  getModuleSettings(signal?: AbortSignal): Promise<PhoenixModules>
  getNavigationRoute(signal?: AbortSignal): Promise<NavigationRoute>
  getNumpadSnapshot(signal?: AbortSignal): Promise<NumpadTreeSnapshot>
  getPairingStatus(signal?: AbortSignal): Promise<PairingStatus>
  getRuntimeState(signal?: AbortSignal): Promise<RuntimeState>
  getShipCatalogue(signal?: AbortSignal): Promise<ShipCatalogueResponse>
  getSystemCartography(systemName?: string, signal?: AbortSignal): Promise<CartographyLookupResponse>
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
  saveControlLayout(layout: ControlGridLayout, signal?: AbortSignal): Promise<ControlGridLayout>
  saveModuleSettings(settings: PhoenixModules, signal?: AbortSignal): Promise<PhoenixModules>
  selectCopilotProfile(profileId: string, signal?: AbortSignal): Promise<CopilotProfilesResponse>
  startMacroRecording(clientId: string, signal?: AbortSignal): Promise<MacroRecording>
  stopMacroRecording(recordingId: string, clientId: string, signal?: AbortSignal): Promise<MacroRecording>
  streamCopilotMessage(input: CopilotChatRequest, onEvent: (event: CopilotStreamEvent) => void, signal?: AbortSignal): Promise<void>
  updateCopilotProfile(profileId: string, input: CopilotProfileWriteRequest, signal?: AbortSignal): Promise<CopilotProfileDocument>
  updateCopilotVoiceHost(input: CopilotVoiceHostHeartbeat, signal?: AbortSignal): Promise<CopilotVoiceHostSnapshot>
  eventStreamUrl(): string
}
