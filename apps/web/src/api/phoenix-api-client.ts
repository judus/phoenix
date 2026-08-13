import {
  CatalogueDiagnosticsSchema,
  ShipCatalogueResponseSchema,
  ControlGridLayoutSchema,
  CopilotChatRequestSchema,
  CopilotAudioProcessingSchema,
  CopilotConversationEventSchema,
  CopilotHistoryResponseSchema,
  CopilotRealtimeTokenRequestSchema,
  CopilotRealtimeTokenResponseSchema,
  CopilotRealtimeToolRequestSchema,
  CopilotRealtimeTurnRequestSchema,
  CopilotVoiceHostCommandAcceptedSchema,
  CopilotVoiceHostHeartbeatSchema,
  CopilotVoiceHostSnapshotSchema,
  CartographyLookupResponseSchema,
  DisplayCommandSchema,
  EngineeringBlueprintDetailSchema,
  EngineeringBlueprintsResponseSchema,
  EngineeringEngineersResponseSchema,
  EngineeringMaterialsResponseSchema,
  ExplorationLedgerResponseSchema,
  ExplorationManualCompletionResponseSchema,
  GalaxyCommodityMarketsResponseSchema,
  GalaxyNearestStationsResponseSchema,
  GameActionCatalogResponseSchema,
  GameActionResultSchema,
  EliteJournalSourceDiagnosticsSchema,
  ActivityLogResponseSchema,
  EliteStatusSourceDiagnosticsSchema,
  RuntimeStateSchema,
  NavigationRouteSchema,
  type GameActionCatalogResponse,
  type CatalogueDiagnostics,
  type ShipCatalogueResponse,
  type ControlGridLayout,
  type CopilotChatRequest,
  type CopilotAudioProcessing,
  type CopilotConversationEvent,
  type CopilotHistoryResponse,
  type CopilotRealtimeTokenRequest,
  type CopilotRealtimeTokenResponse,
  type CopilotRealtimeToolRequest,
  type CopilotRealtimeTurnRequest,
  type CopilotVoiceHostCommandAccepted,
  type CopilotVoiceHostHeartbeat,
  type CopilotVoiceHostSnapshot,
  type CartographyLookupResponse,
  type DisplayCommand,
  type EngineeringBlueprintDetail,
  type EngineeringBlueprintsResponse,
  type EngineeringEngineersResponse,
  type EngineeringMaterial,
  type EngineeringMaterialsResponse,
  type ExplorationLedgerResponse,
  type ExplorationManualCompletionRequest,
  type ExplorationManualCompletionResponse,
  type GalaxyCommodityMarketsResponse,
  type GalaxyNearestStationsResponse,
  type GameActionResult,
  type GameActionOperation,
  type EliteJournalSourceDiagnostics,
  type ActivityLogResponse,
  type EliteStatusSourceDiagnostics,
  type HealthResponse,
  type NavigationRoute,
  type RuntimeState
} from '@phoenix/contracts'

export interface PhoenixApi {
  claimPairing(code: string): Promise<PairingStatus>
  createCopilotRealtimeToken(input: CopilotRealtimeTokenRequest): Promise<CopilotRealtimeTokenResponse>
  executeCopilotRealtimeTool(input: CopilotRealtimeToolRequest): Promise<unknown>
  getCopilotAudioProcessing(): Promise<CopilotAudioProcessing>
  getCopilotRealtimeContext(): Promise<{ fingerprint: string, text: string, updatedAt: string | null }>
  getCatalogueDiagnostics(): Promise<CatalogueDiagnostics>
  getShipCatalogue(): Promise<ShipCatalogueResponse>
  getControlLayout(): Promise<ControlGridLayout>
  getCopilotHistory(conversationId: string): Promise<CopilotHistoryResponse>
  executeDeveloperAction(actionId: string): Promise<GameActionResult>
  executeAction(actionId: string, operation?: GameActionOperation): Promise<GameActionResult>
  getEliteJournalDiagnostics(): Promise<EliteJournalSourceDiagnostics>
  getActivityLog(limit?: number): Promise<ActivityLogResponse>
  getEliteStatusDiagnostics(): Promise<EliteStatusSourceDiagnostics>
  getActions(): Promise<GameActionCatalogResponse>
  getDeveloperActions(): Promise<GameActionCatalogResponse>
  getHealth(): Promise<HealthResponse>
  getPairingStatus(): Promise<PairingStatus>
  getEngineeringBlueprint(symbol: string): Promise<EngineeringBlueprintDetail>
  getEngineeringBlueprints(): Promise<EngineeringBlueprintsResponse>
  getEngineeringEngineers(): Promise<EngineeringEngineersResponse>
  getEngineeringMaterials(category: EngineeringMaterial['category']): Promise<EngineeringMaterialsResponse>
  getExplorationLedger(): Promise<ExplorationLedgerResponse>
  findGalaxyCommodityMarkets(input: GalaxyCommodityMarketSearch): Promise<GalaxyCommodityMarketsResponse>
  findGalaxyNearestStations(input: GalaxyNearestStationSearch): Promise<GalaxyNearestStationsResponse>
  setExplorationBiologicalCompletion(input: ExplorationManualCompletionRequest): Promise<ExplorationManualCompletionResponse>
  getRuntimeState(): Promise<RuntimeState>
  getNavigationRoute(): Promise<NavigationRoute>
  getSystemCartography(systemName?: string): Promise<CartographyLookupResponse>
  persistCopilotRealtimeTurn(input: CopilotRealtimeTurnRequest): Promise<void>
  publishCopilotConversationEvent(event: CopilotConversationEvent): Promise<void>
  getCopilotVoiceHost(): Promise<CopilotVoiceHostSnapshot>
  updateCopilotVoiceHost(input: CopilotVoiceHostHeartbeat): Promise<CopilotVoiceHostSnapshot>
  releaseCopilotVoiceHost(hostId: string): Promise<void>
  requestCopilotVoiceHostState(connected: boolean): Promise<CopilotVoiceHostCommandAccepted>
  saveControlLayout(layout: ControlGridLayout): Promise<ControlGridLayout>
  runtimeStateStreamUrl(): string
  activityLogStreamUrl(): string
  displayCommandStreamUrl(): string
  copilotConversationStreamUrl(conversationId: string): string
  eventStreamUrl(conversationId?: string): string
  copilotVoiceHostStreamUrl(): string
  copilotVoiceHostCommandStreamUrl(hostId: string): string
  streamCopilotMessage(
    input: CopilotChatRequest,
    onEvent: (event: CopilotStreamEvent) => void,
    signal?: AbortSignal
  ): Promise<void>
}

export interface PairingStatus {
  authenticated: boolean
  installationId: string
  pairingRequired: boolean
}

export interface GalaxyCommodityMarketSearch {
  commodity: string
  fleetCarriers?: boolean
  intent: 'buy' | 'sell'
  maxDaysAgo?: number
  maxDistance?: number
  minVolume?: number
  systemName: string
}

export interface GalaxyNearestStationSearch {
  minimumPadSize?: 'small' | 'medium' | 'large'
  service: string
  systemName: string
}

export type CopilotStreamEvent =
  | { type: 'started', conversationId: string }
  | { type: 'retrying', attempt: number }
  | { type: 'reset' }
  | { type: 'delta', delta: string }
  | { type: 'tool', callId: string, name?: string, status: string }
  | { type: 'completed', conversationId: string, text: string }

export class PhoenixApiClient implements PhoenixApi {
  private readonly request: typeof fetch

  public constructor (
    private readonly baseUrl = '',
    request: typeof fetch = globalThis.fetch
  ) {
    this.request = request.bind(globalThis)
  }

  public async getPairingStatus (): Promise<PairingStatus> {
    const response = await this.request(`${this.baseUrl}/api/pairing/status`, {
      headers: { accept: 'application/json' }
    })
    if (!response.ok) throw await apiError(response)
    return pairingStatus(await response.json())
  }

  public async claimPairing (code: string): Promise<PairingStatus> {
    const response = await this.request(`${this.baseUrl}/api/pairing/claim`, {
      body: JSON.stringify({ code }),
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      method: 'POST'
    })
    if (!response.ok) throw await apiError(response)
    return pairingStatus(await response.json())
  }

  public async getHealth (): Promise<HealthResponse> {
    const response = await this.request(`${this.baseUrl}/api/health`, {
      headers: { accept: 'application/json' }
    })
    if (!response.ok) throw new Error(`PHOENIX API returned HTTP ${response.status}.`)
    return response.json() as Promise<HealthResponse>
  }

  public async getEngineeringEngineers (): Promise<EngineeringEngineersResponse> {
    const response = await this.request(`${this.baseUrl}/api/engineering/engineers`, {
      headers: { accept: 'application/json' }
    })
    if (!response.ok) throw await apiError(response)
    return EngineeringEngineersResponseSchema.parse(await response.json())
  }

  public async getEngineeringMaterials (
    category: EngineeringMaterial['category']
  ): Promise<EngineeringMaterialsResponse> {
    const response = await this.request(
      `${this.baseUrl}/api/engineering/materials?category=${encodeURIComponent(category)}`,
      { headers: { accept: 'application/json' } }
    )
    if (!response.ok) throw await apiError(response)
    return EngineeringMaterialsResponseSchema.parse(await response.json())
  }

  public async getEngineeringBlueprints (): Promise<EngineeringBlueprintsResponse> {
    const response = await this.request(`${this.baseUrl}/api/engineering/blueprints`, {
      headers: { accept: 'application/json' }
    })
    if (!response.ok) throw await apiError(response)
    return EngineeringBlueprintsResponseSchema.parse(await response.json())
  }

  public async getEngineeringBlueprint (symbol: string): Promise<EngineeringBlueprintDetail> {
    const response = await this.request(
      `${this.baseUrl}/api/engineering/blueprints/${encodeURIComponent(symbol)}`,
      { headers: { accept: 'application/json' } }
    )
    if (!response.ok) throw await apiError(response)
    return EngineeringBlueprintDetailSchema.parse(await response.json())
  }

  public async getExplorationLedger (): Promise<ExplorationLedgerResponse> {
    const response = await this.request(`${this.baseUrl}/api/exploration/ledger`, {
      headers: { accept: 'application/json' }
    })
    if (!response.ok) throw await apiError(response)
    return ExplorationLedgerResponseSchema.parse(await response.json())
  }

  public async setExplorationBiologicalCompletion (
    input: ExplorationManualCompletionRequest
  ): Promise<ExplorationManualCompletionResponse> {
    const response = await this.request(`${this.baseUrl}/api/exploration/biological-completion`, {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify(input)
    })
    if (!response.ok) throw await apiError(response)
    return ExplorationManualCompletionResponseSchema.parse(await response.json())
  }

  public async getActions (): Promise<GameActionCatalogResponse> {
    const response = await this.request(`${this.baseUrl}/api/actions`, {
      headers: { accept: 'application/json' }
    })
    if (!response.ok) throw new Error(`PHOENIX API returned HTTP ${response.status}.`)
    return GameActionCatalogResponseSchema.parse(await response.json())
  }

  public async getDeveloperActions (): Promise<GameActionCatalogResponse> {
    return this.getActions()
  }

  public async getCatalogueDiagnostics (): Promise<CatalogueDiagnostics> {
    const response = await this.request(`${this.baseUrl}/api/developer/catalogue`, {
      headers: { accept: 'application/json' }
    })
    if (!response.ok) throw new Error(`PHOENIX API returned HTTP ${response.status}.`)
    return CatalogueDiagnosticsSchema.parse(await response.json())
  }

  public async getShipCatalogue (): Promise<ShipCatalogueResponse> {
    const response = await this.request(`${this.baseUrl}/api/catalogue/ships`)
    if (!response.ok) throw new Error(`PHOENIX API returned HTTP ${response.status}.`)
    return ShipCatalogueResponseSchema.parse(await response.json())
  }

  public async getControlLayout (): Promise<ControlGridLayout> {
    const response = await this.request(`${this.baseUrl}/api/control-layout`, {
      headers: { accept: 'application/json' }
    })
    if (!response.ok) throw new Error(`PHOENIX API returned HTTP ${response.status}.`)
    return ControlGridLayoutSchema.parse(await response.json())
  }

  public async getCopilotHistory (conversationId: string): Promise<CopilotHistoryResponse> {
    const response = await this.request(
      `${this.baseUrl}/api/copilot/conversations/${encodeURIComponent(conversationId)}`,
      { headers: { accept: 'application/json' } }
    )
    if (!response.ok) throw await apiError(response)
    return CopilotHistoryResponseSchema.parse(await response.json())
  }

  public async getCopilotAudioProcessing (): Promise<CopilotAudioProcessing> {
    const response = await this.request(`${this.baseUrl}/api/copilot/realtime/audio-processing`, {
      headers: { accept: 'application/json' }
    })
    if (!response.ok) throw await apiError(response)
    const payload = await response.json() as { audioProcessing?: unknown }
    return CopilotAudioProcessingSchema.parse(payload.audioProcessing)
  }

  public async getCopilotVoiceHost (): Promise<CopilotVoiceHostSnapshot> {
    const response = await this.request(`${this.baseUrl}/api/copilot/voice-host`, {
      headers: { accept: 'application/json' }
    })
    if (!response.ok) throw await apiError(response)
    return CopilotVoiceHostSnapshotSchema.parse(await response.json())
  }

  public async updateCopilotVoiceHost (
    input: CopilotVoiceHostHeartbeat
  ): Promise<CopilotVoiceHostSnapshot> {
    const response = await this.request(`${this.baseUrl}/api/copilot/voice-host`, {
      body: JSON.stringify(CopilotVoiceHostHeartbeatSchema.parse(input)),
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      method: 'PUT'
    })
    if (!response.ok) throw await apiError(response)
    return CopilotVoiceHostSnapshotSchema.parse(await response.json())
  }

  public async releaseCopilotVoiceHost (hostId: string): Promise<void> {
    const response = await this.request(
      `${this.baseUrl}/api/copilot/voice-host?hostId=${encodeURIComponent(hostId)}`,
      { method: 'DELETE' }
    )
    if (!response.ok) throw await apiError(response)
  }

  public async requestCopilotVoiceHostState (
    connected: boolean
  ): Promise<CopilotVoiceHostCommandAccepted> {
    const response = await this.request(`${this.baseUrl}/api/copilot/voice-host/desired-state`, {
      body: JSON.stringify({ connected }),
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      method: 'POST'
    })
    if (!response.ok) throw await apiError(response)
    return CopilotVoiceHostCommandAcceptedSchema.parse(await response.json())
  }

  public async getCopilotRealtimeContext (): Promise<{
    fingerprint: string
    text: string
    updatedAt: string | null
  }> {
    const response = await this.request(`${this.baseUrl}/api/copilot/realtime/context`, {
      headers: { accept: 'application/json' }
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

  public async createCopilotRealtimeToken (
    input: CopilotRealtimeTokenRequest
  ): Promise<CopilotRealtimeTokenResponse> {
    const response = await this.request(`${this.baseUrl}/api/copilot/realtime/token`, {
      body: JSON.stringify(CopilotRealtimeTokenRequestSchema.parse(input)),
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      method: 'POST'
    })
    if (!response.ok) throw await apiError(response)
    return CopilotRealtimeTokenResponseSchema.parse(await response.json())
  }

  public async executeCopilotRealtimeTool (input: CopilotRealtimeToolRequest): Promise<unknown> {
    const response = await this.request(`${this.baseUrl}/api/copilot/realtime/tool`, {
      body: JSON.stringify(CopilotRealtimeToolRequestSchema.parse(input)),
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      method: 'POST'
    })
    if (!response.ok) throw await apiError(response)
    const payload = await response.json() as { result?: unknown }
    return payload.result
  }

  public async persistCopilotRealtimeTurn (input: CopilotRealtimeTurnRequest): Promise<void> {
    const response = await this.request(`${this.baseUrl}/api/copilot/realtime/turn`, {
      body: JSON.stringify(CopilotRealtimeTurnRequestSchema.parse(input)),
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      method: 'POST'
    })
    if (!response.ok) throw await apiError(response)
  }

  public async publishCopilotConversationEvent (event: CopilotConversationEvent): Promise<void> {
    const validated = CopilotConversationEventSchema.parse(event)
    const response = await this.request(
      `${this.baseUrl}/api/copilot/conversations/${encodeURIComponent(validated.conversationId)}/events`,
      {
        body: JSON.stringify(validated),
        headers: { accept: 'application/json', 'content-type': 'application/json' },
        method: 'POST'
      }
    )
    if (!response.ok) throw await apiError(response)
  }

  public async streamCopilotMessage (
    input: CopilotChatRequest,
    onEvent: (event: CopilotStreamEvent) => void,
    signal?: AbortSignal
  ): Promise<void> {
    const response = await this.request(`${this.baseUrl}/api/copilot/chat`, {
      body: JSON.stringify(CopilotChatRequestSchema.parse(input)),
      headers: {
        accept: 'text/event-stream',
        'content-type': 'application/json'
      },
      method: 'POST',
      ...(signal === undefined ? {} : { signal })
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
        const frame = buffered.slice(0, boundary)
        buffered = buffered.slice(boundary + 2)
        const event = parseCopilotStreamFrame(frame)
        if (event) onEvent(event)
        boundary = buffered.indexOf('\n\n')
      }
      if (result.done) break
    }
  }

  public async saveControlLayout (layout: ControlGridLayout): Promise<ControlGridLayout> {
    const response = await this.request(`${this.baseUrl}/api/control-layout`, {
      body: JSON.stringify(layout),
      headers: {
        accept: 'application/json',
        'content-type': 'application/json'
      },
      method: 'PUT'
    })
    if (!response.ok) throw new Error(`PHOENIX API returned HTTP ${response.status}.`)
    return ControlGridLayoutSchema.parse(await response.json())
  }

  public async executeDeveloperAction (actionId: string): Promise<GameActionResult> {
    const response = await this.request(`${this.baseUrl}/api/developer/actions/execute`, {
      body: JSON.stringify({ actionId, operation: 'tap' }),
      headers: {
        accept: 'application/json',
        'content-type': 'application/json'
      },
      method: 'POST'
    })
    if (!response.ok) throw new Error(`PHOENIX API returned HTTP ${response.status}.`)
    return GameActionResultSchema.parse(await response.json())
  }

  public async executeAction (
    actionId: string,
    operation: GameActionOperation = 'tap'
  ): Promise<GameActionResult> {
    const response = await this.request(`${this.baseUrl}/api/actions/execute`, {
      body: JSON.stringify({ actionId, operation }),
      headers: {
        accept: 'application/json',
        'content-type': 'application/json'
      },
      method: 'POST'
    })
    if (!response.ok) throw new Error(`PHOENIX API returned HTTP ${response.status}.`)
    return GameActionResultSchema.parse(await response.json())
  }

  public async getEliteStatusDiagnostics (): Promise<EliteStatusSourceDiagnostics> {
    const response = await this.request(`${this.baseUrl}/api/developer/elite-status`, {
      headers: { accept: 'application/json' }
    })
    if (!response.ok) throw new Error(`PHOENIX API returned HTTP ${response.status}.`)
    return EliteStatusSourceDiagnosticsSchema.parse(await response.json())
  }

  public async getEliteJournalDiagnostics (): Promise<EliteJournalSourceDiagnostics> {
    const response = await this.request(`${this.baseUrl}/api/developer/elite-journal`, {
      headers: { accept: 'application/json' }
    })
    if (!response.ok) throw new Error(`PHOENIX API returned HTTP ${response.status}.`)
    return EliteJournalSourceDiagnosticsSchema.parse(await response.json())
  }

  public async getActivityLog (limit = 250): Promise<ActivityLogResponse> {
    const response = await this.request(`${this.baseUrl}/api/log?limit=${encodeURIComponent(limit)}`, {
      headers: { accept: 'application/json' }
    })
    if (!response.ok) throw new Error(`PHOENIX API returned HTTP ${response.status}.`)
    return ActivityLogResponseSchema.parse(await response.json())
  }

  public async getRuntimeState (): Promise<RuntimeState> {
    const response = await this.request(`${this.baseUrl}/api/runtime-state`, {
      headers: { accept: 'application/json' }
    })
    if (!response.ok) throw new Error(`PHOENIX API returned HTTP ${response.status}.`)
    return RuntimeStateSchema.parse(await response.json())
  }

  public async getNavigationRoute (): Promise<NavigationRoute> {
    const response = await this.request(`${this.baseUrl}/api/navigation/route`, {
      headers: { accept: 'application/json' }
    })
    if (!response.ok) throw await apiError(response)
    return NavigationRouteSchema.parse(await response.json())
  }

  public async getSystemCartography (systemName?: string): Promise<CartographyLookupResponse> {
    const query = systemName?.trim()
      ? `?name=${encodeURIComponent(systemName.trim())}`
      : ''
    const response = await this.request(`${this.baseUrl}/api/navigation/system${query}`, {
      headers: { accept: 'application/json' }
    })
    if (!response.ok) throw await apiError(response)
    return CartographyLookupResponseSchema.parse(await response.json())
  }

  public async findGalaxyNearestStations (input: GalaxyNearestStationSearch): Promise<GalaxyNearestStationsResponse> {
    const query = new URLSearchParams({ service: input.service, system: input.systemName })
    if (input.minimumPadSize) query.set('pad', input.minimumPadSize)
    const response = await this.request(`${this.baseUrl}/api/galaxy/nearest?${query.toString()}`, {
      headers: { accept: 'application/json' }
    })
    if (!response.ok) throw await apiError(response)
    return GalaxyNearestStationsResponseSchema.parse(await response.json())
  }

  public async findGalaxyCommodityMarkets (input: GalaxyCommodityMarketSearch): Promise<GalaxyCommodityMarketsResponse> {
    const query = new URLSearchParams({
      commodity: input.commodity,
      intent: input.intent,
      system: input.systemName
    })
    if (input.fleetCarriers !== undefined) query.set('fleetCarriers', String(input.fleetCarriers))
    if (input.maxDaysAgo !== undefined) query.set('maxDaysAgo', String(input.maxDaysAgo))
    if (input.maxDistance !== undefined) query.set('maxDistance', String(input.maxDistance))
    if (input.minVolume !== undefined) query.set('minVolume', String(input.minVolume))
    const response = await this.request(`${this.baseUrl}/api/galaxy/markets?${query.toString()}`, {
      headers: { accept: 'application/json' }
    })
    if (!response.ok) throw await apiError(response)
    return GalaxyCommodityMarketsResponseSchema.parse(await response.json())
  }

  public runtimeStateStreamUrl (): string {
    return `${this.baseUrl}/api/runtime-state/stream`
  }

  public activityLogStreamUrl (): string {
    return `${this.baseUrl}/api/log/stream`
  }

  public displayCommandStreamUrl (): string {
    return `${this.baseUrl}/api/display/stream`
  }

  public copilotConversationStreamUrl (conversationId: string): string {
    return `${this.baseUrl}/api/copilot/conversations/${encodeURIComponent(conversationId)}/stream`
  }

  public eventStreamUrl (conversationId = 'phoenix-copilot'): string {
    return `${this.baseUrl}/api/events?conversationId=${encodeURIComponent(conversationId)}`
  }

  public copilotVoiceHostStreamUrl (): string {
    return `${this.baseUrl}/api/copilot/voice-host/stream`
  }

  public copilotVoiceHostCommandStreamUrl (hostId: string): string {
    return `${this.baseUrl}/api/copilot/voice-host/commands/stream?hostId=${encodeURIComponent(hostId)}`
  }
}

export function parseDisplayCommand (candidate: unknown): DisplayCommand {
  return DisplayCommandSchema.parse(candidate)
}

async function apiError (response: Response): Promise<Error> {
  try {
    const payload = await response.json() as { error?: { message?: unknown } }
    if (typeof payload.error?.message === 'string') return new Error(payload.error.message)
  } catch {}
  return new Error(`PHOENIX API returned HTTP ${response.status}.`)
}

function pairingStatus (candidate: unknown): PairingStatus {
  if (typeof candidate !== 'object' || candidate === null) throw new Error('Invalid PHOENIX pairing response.')
  const value = candidate as Record<string, unknown>
  if (typeof value.authenticated !== 'boolean' || typeof value.installationId !== 'string' ||
      typeof value.pairingRequired !== 'boolean') {
    throw new Error('Invalid PHOENIX pairing response.')
  }
  return {
    authenticated: value.authenticated,
    installationId: value.installationId,
    pairingRequired: value.pairingRequired
  }
}

function parseCopilotStreamFrame (frame: string): CopilotStreamEvent | undefined {
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
    case 'tool': {
      const name = payload.name === undefined ? undefined : stringField(payload, 'name')
      return {
        type,
        callId: stringField(payload, 'callId'),
        ...(name === undefined ? {} : { name }),
        status: stringField(payload, 'status')
      }
    }
    case 'completed': return {
      type,
      conversationId: stringField(payload, 'conversationId'),
      text: stringField(payload, 'text')
    }
    case 'error': {
      const error = isRecord(payload.error) ? payload.error : {}
      throw new Error(typeof error.message === 'string' ? error.message : 'Copilot stream failed.')
    }
    default: return undefined
  }
}

function isRecord (candidate: unknown): candidate is Record<string, unknown> {
  return typeof candidate === 'object' && candidate !== null && !Array.isArray(candidate)
}

function stringField (record: Record<string, unknown>, key: string): string {
  const value = record[key]
  if (typeof value !== 'string') throw new Error(`Copilot event field ${key} must be a string.`)
  return value
}

function numberField (record: Record<string, unknown>, key: string): number {
  const value = record[key]
  if (typeof value !== 'number') throw new Error(`Copilot event field ${key} must be a number.`)
  return value
}
