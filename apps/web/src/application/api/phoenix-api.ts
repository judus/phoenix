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
  CommandCatalogResponse,
  CommanderLogResponse,
  CommanderEquipmentResponse,
  PersonalEquipmentUpgradesResponse,
  PersonalEquipmentSpecialistsResponse,
  PersonalMaterialInventoryResponse,
  DashboardMarketSignalsResponse,
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
  EngineeringMaterialWatchlistResponse,
  EngineeringProject,
  EngineeringProjectCreateRequest,
  EngineeringProjectsResponse,
  EngineeringProjectStepCreateRequest,
  EngineeringProjectUpdateRequest,
  ExplorationLedgerResponse,
  GalaxySystemSearchResponse,
  GalaxyCommodityMarketsResponse,
  GalaxyMarketSignalsResponse,
  GalaxyExplorationTargetsResponse,
  GalaxyFactionPresencesResponse,
  GalaxyNearestStationsResponse,
  GalaxyOutfittingResponse,
  GalaxyShipyardsResponse,
  GalaxyStationLookupResponse,
  GalaxyTradeOpportunitiesResponse,
  GalaxyBookmark,
  GalaxyBookmarksResponse,
  GalaxyBookmarkWriteRequest,
  HealthResponse,
  InstallationSettings,
  InstallationSettingsUpdate,
  LocalTrafficResponse,
  MacroDefinition,
  MacroLibrary,
  MacroPlayback,
  MacroRecording,
  MissionsResponse,
  NavigationRoute,
  PlotEliteDestinationResult,
  NumpadExecutionResult,
  NumpadTreeSnapshot,
  PairingInfo,
  PairingStatus,
  OpenAiConfigurationStatus,
  PhoenixModules,
  PhoenixControlDeckConfiguration,
  RuntimeState,
  SavedGalaxyQueriesResponse,
  SavedGalaxyQuery,
  SavedGalaxyQueryWriteRequest,
  ShipCatalogueResponse
} from '@phoenix/contracts'
import type { ControlDeckCommandCatalogue } from 'control-deck/core'

export type CopilotStreamEvent =
  | { type: 'started', conversationId: string }
  | { type: 'retrying', attempt: number }
  | { type: 'reset' }
  | { type: 'delta', delta: string }
  | { type: 'tool', callId: string, name?: string, status: string }
  | { type: 'completed', conversationId: string, text: string }

export interface GalaxySystemSearch {
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

export interface GalaxyNearestStationSearch { minimumPadSize?: PadSize, service: string, systemName: string }
export interface GalaxyShipyardSearch { hullName: string, limit?: number, systemName: string }
export interface GalaxyOutfittingSearch { limit?: number, maxDaysAgo?: number, maxDistance?: number, minimumPadSize?: PadSize, module: string, systemName: string }
export interface GalaxyStationLookupSearch { limit?: number, maxDistance?: number, minimumPadSize?: PadSize, name: string, stationType?: 'any' | 'carrier' | 'orbital' | 'surface', systemName: string }
export interface GalaxyCommodityMarketSearch { commodity: string, fleetCarriers?: boolean, intent: 'buy' | 'sell', maxDaysAgo?: number, maxDistance?: number, minVolume?: number, systemName: string }
export interface GalaxyMarketSignalSearch { fleetCarriers?: boolean, limit?: number, maxDaysAgo?: number, minDeviationPercent?: number, minimumPadSize?: PadSize, minVolume?: number, sides: Array<'buy' | 'sell'>, systemName: string }
export interface GalaxyTradeOpportunitySearch { availableCredits: number, cargoCapacity: number, fleetCarriers?: boolean, limit?: number, maxDaysAgo?: number, maxDistance?: number, minVolume?: number, systemName: string }
export interface GalaxyFactionPresenceSearch { allegiance?: string, controlling?: 'any' | 'yes' | 'no', factionName: string, government?: string, limit?: number, maxDistance?: number, minInfluence?: number, state?: string, systemName: string }
export interface GalaxyExplorationTargetSearch { atmospheres?: string[], bodySubtypes?: string[], landable?: 'any' | 'yes' | 'no', lastReportedBefore?: string, limit?: number, maxDistance?: number, maxGravityG?: number, maxTemperatureK?: number, minBiologicalSignals?: number, minGeologicalSignals?: number, minGravityG?: number, minTemperatureK?: number, systemName: string, volcanismTypes?: string[] }
type PadSize = 'small' | 'medium' | 'large'

export interface PhoenixApi {
  abortMacroPlayback(signal?: AbortSignal): Promise<MacroPlayback | null>
  cancelMacroRecording(recordingId: string, clientId: string, signal?: AbortSignal): Promise<void>
  claimPairing(code: string, signal?: AbortSignal): Promise<PairingStatus>
  createCopilotProfile(input: CopilotProfileWriteRequest, signal?: AbortSignal): Promise<CopilotProfileDocument>
  createCopilotRealtimeToken(input: CopilotRealtimeTokenRequest, signal?: AbortSignal): Promise<CopilotRealtimeTokenResponse>
  deleteMacro(id: string, signal?: AbortSignal): Promise<void>
  executeCopilotRealtimeTool(input: CopilotRealtimeToolRequest, signal?: AbortSignal): Promise<unknown>
  executeAction(actionId: string, operation?: GameActionOperation, options?: { leaseId?: string, signal?: AbortSignal }): Promise<GameActionResult>
  executeNumpadAddress(address: string, revision: number, operation?: GameActionOperation, leaseId?: string, signal?: AbortSignal): Promise<NumpadExecutionResult>
  getEngineeringBlueprint(symbol: string, signal?: AbortSignal): Promise<EngineeringBlueprintDetail>
  getEngineeringBlueprints(signal?: AbortSignal): Promise<EngineeringBlueprintsResponse>
  getEngineeringEngineers(signal?: AbortSignal): Promise<EngineeringEngineersResponse>
  getEngineeringMaterials(category: EngineeringMaterial['category'], signal?: AbortSignal): Promise<EngineeringMaterialsResponse>
  getEngineeringProjects(signal?: AbortSignal): Promise<EngineeringProjectsResponse>
  getEngineeringMaterialWatchlist(signal?: AbortSignal): Promise<EngineeringMaterialWatchlistResponse>
  createEngineeringProject(input: EngineeringProjectCreateRequest, signal?: AbortSignal): Promise<EngineeringProject>
  updateEngineeringProject(id: string, input: EngineeringProjectUpdateRequest, signal?: AbortSignal): Promise<EngineeringProject>
  deleteEngineeringProject(id: string, signal?: AbortSignal): Promise<void>
  addEngineeringProjectStep(projectId: string, input: EngineeringProjectStepCreateRequest, signal?: AbortSignal): Promise<EngineeringProject>
  deleteEngineeringProjectStep(projectId: string, stepId: string, signal?: AbortSignal): Promise<EngineeringProject>
  getExplorationLedger(signal?: AbortSignal): Promise<ExplorationLedgerResponse>
  getActions(signal?: AbortSignal): Promise<GameActionCatalogResponse>
  getActivityLog(limit?: number, signal?: AbortSignal): Promise<ActivityLogResponse>
  getCopilotAudioProcessing(profileId?: string, signal?: AbortSignal): Promise<CopilotAudioProcessing>
  getCopilotHistory(conversationId: string, signal?: AbortSignal): Promise<CopilotHistoryResponse>
  getCopilotProfile(profileId: string, signal?: AbortSignal): Promise<CopilotProfileDocument>
  getCopilotProfiles(signal?: AbortSignal): Promise<CopilotProfilesResponse>
  getCopilotRealtimeContext(signal?: AbortSignal): Promise<{ fingerprint: string, text: string, updatedAt: string | null }>
  getCopilotVoiceHost(signal?: AbortSignal): Promise<CopilotVoiceHostSnapshot>
  getCommunications(view?: 'all' | 'inbox' | 'traffic', limit?: number, signal?: AbortSignal): Promise<CommunicationsResponse>
  getLocalTraffic(limit?: number, signal?: AbortSignal): Promise<LocalTrafficResponse>
  getControlDeckConfiguration(signal?: AbortSignal): Promise<PhoenixControlDeckConfiguration>
  getControlDeckCommands(signal?: AbortSignal): Promise<ControlDeckCommandCatalogue>
  getCommands(signal?: AbortSignal): Promise<CommandCatalogResponse>
  getCommanderLog(limit?: number, signal?: AbortSignal): Promise<CommanderLogResponse>
  getCommanderEquipment(signal?: AbortSignal): Promise<CommanderEquipmentResponse>
  getPersonalEquipmentUpgrades(signal?: AbortSignal): Promise<PersonalEquipmentUpgradesResponse>
  getPersonalEquipmentSpecialists(signal?: AbortSignal): Promise<PersonalEquipmentSpecialistsResponse>
  getPersonalMaterialInventory(signal?: AbortSignal): Promise<PersonalMaterialInventoryResponse>
  getDashboardMarketSignals(signal?: AbortSignal): Promise<DashboardMarketSignalsResponse>
  getFleet(signal?: AbortSignal): Promise<FleetResponse>
  getGalaxyBookmarks(signal?: AbortSignal): Promise<GalaxyBookmarksResponse>
  getGalnetNews(limit?: number, signal?: AbortSignal): Promise<GalnetNewsResponse>
  findGalaxySystems(input: GalaxySystemSearch, signal?: AbortSignal): Promise<GalaxySystemSearchResponse>
  findGalaxyCommodityMarkets(input: GalaxyCommodityMarketSearch, signal?: AbortSignal): Promise<GalaxyCommodityMarketsResponse>
  findGalaxyMarketSignals(input: GalaxyMarketSignalSearch, signal?: AbortSignal): Promise<GalaxyMarketSignalsResponse>
  findGalaxyExplorationTargets(input: GalaxyExplorationTargetSearch, signal?: AbortSignal): Promise<GalaxyExplorationTargetsResponse>
  findGalaxyFactionPresences(input: GalaxyFactionPresenceSearch, signal?: AbortSignal): Promise<GalaxyFactionPresencesResponse>
  findGalaxyNearestStations(input: GalaxyNearestStationSearch, signal?: AbortSignal): Promise<GalaxyNearestStationsResponse>
  findGalaxyOutfitting(input: GalaxyOutfittingSearch, signal?: AbortSignal): Promise<GalaxyOutfittingResponse>
  findGalaxyShipyards(input: GalaxyShipyardSearch, signal?: AbortSignal): Promise<GalaxyShipyardsResponse>
  findGalaxyStations(input: GalaxyStationLookupSearch, signal?: AbortSignal): Promise<GalaxyStationLookupResponse>
  findGalaxyTradeOpportunities(input: GalaxyTradeOpportunitySearch, signal?: AbortSignal): Promise<GalaxyTradeOpportunitiesResponse>
  getHealth(signal?: AbortSignal): Promise<HealthResponse>
  getInstallationSettings(signal?: AbortSignal): Promise<InstallationSettings>
  getMacros(signal?: AbortSignal): Promise<MacroLibrary>
  getMissions(signal?: AbortSignal): Promise<MissionsResponse>
  getModuleSettings(signal?: AbortSignal): Promise<PhoenixModules>
  getNavigationRoute(signal?: AbortSignal): Promise<NavigationRoute>
  plotEliteDestination(systemName: string, signal?: AbortSignal): Promise<PlotEliteDestinationResult>
  getNumpadSnapshot(signal?: AbortSignal): Promise<NumpadTreeSnapshot>
  getPairingInfo(signal?: AbortSignal): Promise<PairingInfo>
  getPairingStatus(signal?: AbortSignal): Promise<PairingStatus>
  getRuntimeState(signal?: AbortSignal): Promise<RuntimeState>
  getSavedGalaxyQueries(signal?: AbortSignal): Promise<SavedGalaxyQueriesResponse>
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
  releasePairing(signal?: AbortSignal): Promise<void>
  requestCopilotVoiceHostState(connected: boolean, signal?: AbortSignal): Promise<CopilotVoiceHostCommandAccepted>
  saveMacro(macro: MacroDefinition, signal?: AbortSignal): Promise<MacroDefinition>
  saveGalaxyBookmark(input: GalaxyBookmarkWriteRequest, id?: string, signal?: AbortSignal): Promise<GalaxyBookmark>
  saveControlDeckConfiguration(configuration: PhoenixControlDeckConfiguration, signal?: AbortSignal): Promise<PhoenixControlDeckConfiguration>
  saveModuleSettings(settings: PhoenixModules, signal?: AbortSignal): Promise<PhoenixModules>
  saveInstallationSettings(settings: InstallationSettingsUpdate, signal?: AbortSignal): Promise<InstallationSettings>
  saveOpenAiApiKey(apiKey: string, signal?: AbortSignal): Promise<OpenAiConfigurationStatus>
  saveGalaxyQuery(input: SavedGalaxyQueryWriteRequest, id?: string, signal?: AbortSignal): Promise<SavedGalaxyQuery>
  removeOpenAiApiKey(signal?: AbortSignal): Promise<OpenAiConfigurationStatus>
  selectCopilotProfile(profileId: string, signal?: AbortSignal): Promise<CopilotProfilesResponse>
  startMacroRecording(clientId: string, signal?: AbortSignal): Promise<MacroRecording>
  stopMacroRecording(recordingId: string, clientId: string, signal?: AbortSignal): Promise<MacroRecording>
  streamCopilotMessage(input: CopilotChatRequest, onEvent: (event: CopilotStreamEvent) => void, signal?: AbortSignal): Promise<void>
  updateCopilotProfile(profileId: string, input: CopilotProfileWriteRequest, signal?: AbortSignal): Promise<CopilotProfileDocument>
  updateCopilotVoiceHost(input: CopilotVoiceHostHeartbeat, signal?: AbortSignal): Promise<CopilotVoiceHostSnapshot>
  deleteGalaxyBookmark(id: string, signal?: AbortSignal): Promise<void>
  deleteGalaxyQuery(id: string, signal?: AbortSignal): Promise<void>
  eventStreamUrl(): string
}
