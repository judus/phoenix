import { createReadStream, existsSync, statSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse
} from 'node:http'
import { extname, isAbsolute, join, normalize, relative, resolve, sep } from 'node:path'
import {
  ControlGridLayoutSchema,
  ExecuteCommandRequestSchema,
  CopilotChatRequestSchema,
  CopilotProfileSelectionRequestSchema,
  CopilotProfileWriteRequestSchema,
  CopilotConversationEventSchema,
  CopilotVoiceHostDesiredStateRequestSchema,
  CopilotVoiceHostHeartbeatSchema,
  CopilotRealtimeTokenRequestSchema,
  CopilotRealtimeToolRequestSchema,
  CopilotRealtimeTurnRequestSchema,
  ExplorationManualCompletionRequestSchema,
  MacroDefinitionSchema,
  PhoenixModulesSchema,
  RecordMacroActionRequestSchema,
  StartMacroRecordingRequestSchema,
  type CopilotConversationEvent,
  type DisplayCommand,
  type NavigationRoute,
  type RuntimeState
} from '@phoenix/contracts'
import { AiError, serializeAiError, type AiStreamEvent } from '@judus/llm-client'
import type { CopilotText, CopilotTextRequest } from '../application/copilot-text-service.js'
import type { CopilotConversationEvents } from '../application/copilot-conversation-event-service.js'
import type { CopilotVoiceHostControl } from '../application/copilot-voice-host-coordinator.js'
import type { CopilotProfiles } from '../application/copilot-profile-service.js'
import {
  serializeToolOutput,
  type CopilotRealtime
} from '../application/copilot-realtime-service.js'
import type { CatalogueDiagnosticsReader } from '../application/catalogue-diagnostics-service.js'
import type { GameActions } from '../application/game-action-service.js'
import type { Commands } from '../domain/commands.js'
import type { HealthCheck } from '../application/health-service.js'
import type { EngineeringDataReader } from '../application/engineering-data-service.js'
import type { ExplorationDataReader } from '../application/exploration-data-service.js'
import type { GalaxyDataReader } from '../application/galaxy-data-service.js'
import type { GalnetNewsReader } from '../domain/galnet.js'
import type { NavigationDataReader } from '../application/navigation-data-service.js'
import type { ActivityLogReader, EliteJournalDiagnosticsReader } from '../domain/elite-journal.js'
import type { EliteStatusDiagnosticsReader } from '../domain/elite-status.js'
import type { Subscribable } from '../domain/publisher.js'
import type { RuntimeStateReader } from '../domain/runtime-state.js'
import type { ControlGridLayoutRepository } from '../domain/system-configuration.js'
import type { SystemSettingsRepository } from '../domain/system-configuration.js'
import type { CommandCatalogueSnapshots } from '../domain/commands.js'
import type { NumpadCommands } from '../domain/numpad.js'
import type { Macros } from '../domain/macros.js'
import type { MissionDataReader } from '../domain/missions.js'
import type { CommunicationDataReader, CommunicationQueryView } from '../domain/communications.js'
import type { FleetDataReader } from '../domain/fleet.js'
import type { PhoenixMcpServer } from './phoenix-mcp-server.js'
import { PairingAttemptLimitError, type PairingAccessController } from './pairing-access-controller.js'

const CONTENT_TYPES: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
}

type CopilotConversationEventPayload = CopilotConversationEvent extends infer Event
  ? Event extends CopilotConversationEvent
    ? Omit<Event, 'clientId' | 'conversationId' | 'occurredAt' | 'turnId'>
    : never
  : never

export interface PhoenixHttpServerOptions {
  accessControl?: PairingAccessController
  catalogueDiagnostics: CatalogueDiagnosticsReader
  commandCatalogue: CommandCatalogueSnapshots
  controlGridLayouts: ControlGridLayoutRepository
  copilot?: CopilotText
  copilotProfiles?: CopilotProfiles
  copilotConversationEvents: CopilotConversationEvents
  copilotVoiceHost: CopilotVoiceHostControl
  copilotRealtime?: CopilotRealtime
  commands: Commands
  gameActions: GameActions
  eliteJournalDiagnostics: EliteJournalDiagnosticsReader
  eliteStatusDiagnostics: EliteStatusDiagnosticsReader
  engineering: EngineeringDataReader
  explorationData: ExplorationDataReader
  fleet: FleetDataReader
  galaxyData: GalaxyDataReader
  galnet: GalnetNewsReader
  healthCheck: HealthCheck
  host: string
  activityLog: ActivityLogReader
  displayCommands: Subscribable<DisplayCommand>
  mcpServer: PhoenixMcpServer
  macros: Macros
  missions: MissionDataReader
  communications: CommunicationDataReader
  navigationData: NavigationDataReader
  navigationRouteUpdates: Subscribable<NavigationRoute>
  numpad: NumpadCommands
  port: number
  runtimeState: RuntimeStateReader
  runtimeStateUpdates: Subscribable<RuntimeState>
  systemSettings: SystemSettingsRepository
  webRoot: string
}

export class PhoenixHttpServer {
  private readonly eventStreams = new Set<ServerResponse>()
  private readonly phoenixEventStreams = new Set<ServerResponse>()
  private readonly activityStreams = new Set<ServerResponse>()
  private readonly copilotConversationStreams = new Set<ServerResponse>()
  private readonly copilotVoiceHostStreams = new Set<ServerResponse>()
  private readonly displayStreams = new Set<ServerResponse>()
  private readonly server: Server

  public constructor (private readonly options: PhoenixHttpServerOptions) {
    this.server = createServer((request, response) => {
      void this.handle(request, response).catch(cause => {
        const message = cause instanceof Error ? cause.message : 'Unknown server error.'
        this.writeJson(response, 500, {
          error: { code: 'internal_error', message }
        })
      })
    })
  }

  public async start (): Promise<{ host: string, port: number }> {
    await new Promise<void>((resolvePromise, reject) => {
      this.server.once('error', reject)
      this.server.listen(this.options.port, this.options.host, () => {
        this.server.off('error', reject)
        resolvePromise()
      })
    })

    const address = this.server.address()
    if (!address || typeof address === 'string') throw new Error('PHOENIX server has no TCP address.')
    return { host: this.options.host, port: address.port }
  }

  public async stop (): Promise<void> {
    if (!this.server.listening) return
    for (const stream of this.eventStreams) stream.end()
    this.eventStreams.clear()
    for (const stream of this.phoenixEventStreams) stream.end()
    this.phoenixEventStreams.clear()
    for (const stream of this.activityStreams) stream.end()
    this.activityStreams.clear()
    for (const stream of this.copilotConversationStreams) stream.end()
    this.copilotConversationStreams.clear()
    for (const stream of this.copilotVoiceHostStreams) stream.end()
    this.copilotVoiceHostStreams.clear()
    for (const stream of this.displayStreams) stream.end()
    this.displayStreams.clear()
    await new Promise<void>((resolvePromise, reject) => {
      this.server.close(error => error ? reject(error) : resolvePromise())
    })
  }

  private async handle (request: IncomingMessage, response: ServerResponse): Promise<void> {
    const url = new URL(request.url ?? '/', 'http://phoenix.local')

    if (request.method === 'GET' && url.pathname === '/api/pairing/status') {
      this.writeJson(response, 200, this.options.accessControl?.status(request) ?? {
        authenticated: true,
        installationId: 'development',
        pairingRequired: false
      })
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/pairing/claim') {
      if (!this.options.accessControl) {
        this.writeJson(response, 200, { authenticated: true, installationId: 'development', pairingRequired: false })
        return
      }
      try {
        const body = await readJsonBody(request)
        const code = isRecord(body) && typeof body.code === 'string' ? body.code : ''
        if (!this.options.accessControl.claim(code)) {
          this.writeJson(response, 401, { error: { code: 'pairing_code_invalid', message: 'The pairing code is invalid.' } })
          return
        }
        response.setHeader('set-cookie', this.options.accessControl.sessionCookie())
        this.writeJson(response, 200, {
          authenticated: true,
          installationId: this.options.accessControl.installationId,
          pairingRequired: true
        })
      } catch (cause) {
        const limited = cause instanceof PairingAttemptLimitError
        this.writeJson(response, limited ? 429 : 400, {
          error: { code: limited ? 'pairing_rate_limited' : 'pairing_request_invalid', message: errorMessage(cause) }
        })
      }
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/pairing/release') {
      response.setHeader('set-cookie', this.options.accessControl?.clearSessionCookie() ?? '')
      this.writeJson(response, 200, { authenticated: false })
      return
    }

    if ((url.pathname === '/mcp' || url.pathname.startsWith('/api/')) &&
        this.options.accessControl && !this.options.accessControl.isAuthorized(request)) {
      response.setHeader('www-authenticate', 'Bearer realm="PHOENIX"')
      this.writeJson(response, 401, { error: { code: 'pairing_required', message: 'Pair this device with PHOENIX.' } })
      return
    }

    if (url.pathname === '/mcp') {
      await this.options.mcpServer.handle(request, response)
      return
    }

    if (request.method === 'GET' && url.pathname === '/api/health') {
      this.writeJson(response, 200, this.options.healthCheck.getHealth())
      return
    }

    if (request.method === 'GET' && url.pathname === '/api/events') {
      this.openPhoenixEventStream(
        request,
        response,
        url.searchParams.get('conversationId') ?? 'phoenix-copilot'
      )
      return
    }

    if (request.method === 'GET' && url.pathname === '/api/runtime-state') {
      this.writeJson(response, 200, this.options.runtimeState.getCurrent())
      return
    }

    if (request.method === 'GET' && url.pathname === '/api/runtime-state/stream') {
      this.openRuntimeStateStream(request, response)
      return
    }

    if (request.method === 'GET' && url.pathname === '/api/log') {
      const requestedLimit = Number.parseInt(url.searchParams.get('limit') ?? '250', 10)
      this.writeJson(response, 200, this.options.activityLog.getRecent(
        Number.isSafeInteger(requestedLimit) ? requestedLimit : 250
      ))
      return
    }

    if (request.method === 'GET' && url.pathname === '/api/galnet') {
      const requestedLimit = Number.parseInt(url.searchParams.get('limit') ?? '40', 10)
      this.writeJson(response, 200, await this.options.galnet.getLatest(
        Number.isSafeInteger(requestedLimit) ? requestedLimit : 40
      ))
      return
    }

    if (request.method === 'GET' && url.pathname === '/api/operations/missions') {
      this.writeJson(response, 200, this.options.missions.getMissions())
      return
    }

    if (request.method === 'GET' && url.pathname === '/api/fleet') {
      this.writeJson(response, 200, this.options.fleet.getFleet())
      return
    }

    if (request.method === 'GET' && url.pathname === '/api/comms/messages') {
      const requestedLimit = Number.parseInt(url.searchParams.get('limit') ?? '250', 10)
      const requestedView = url.searchParams.get('view')
      const view: CommunicationQueryView = requestedView === 'inbox' || requestedView === 'traffic' ? requestedView : 'all'
      this.writeJson(response, 200, this.options.communications.getCommunications(
        view,
        Number.isSafeInteger(requestedLimit) ? requestedLimit : 250
      ))
      return
    }

    if (request.method === 'GET' && url.pathname === '/api/log/stream') {
      this.openActivityStream(request, response)
      return
    }

    if (request.method === 'GET' && url.pathname === '/api/navigation/route') {
      this.writeJson(response, 200, this.options.navigationData.getRoute())
      return
    }

    if (request.method === 'GET' && url.pathname === '/api/navigation/system') {
      try {
        this.writeJson(
          response,
          200,
          await this.options.navigationData.getSystem(url.searchParams.get('name') ?? undefined)
        )
      } catch (cause) {
        this.writeJson(response, 502, {
          error: {
            code: 'cartography_lookup_failed',
            message: cause instanceof Error ? cause.message : 'System cartography lookup failed.'
          }
        })
      }
      return
    }

    if (request.method === 'GET' && url.pathname === '/api/galaxy/nearest') {
      const systemName = requiredQuery(url, 'system')
      const service = requiredQuery(url, 'service')
      const minimumPadSize = optionalPadSize(url.searchParams.get('pad'))
      const padSizes = { small: 1, medium: 2, large: 3 } as const
      this.writeJson(response, 200, await this.options.galaxyData.searchNearestStations({
        minimumPadSize: minimumPadSize ? padSizes[minimumPadSize] : null,
        service,
        systemName
      }, boundedQueryInteger(url, 'limit', 20, 1, 100), minimumPadSize))
      return
    }

    if (request.method === 'GET' && url.pathname === '/api/galaxy/markets') {
      const intent = url.searchParams.get('intent')
      if (intent !== 'buy' && intent !== 'sell') throw new Error('intent must be buy or sell.')
      this.writeJson(response, 200, await this.options.galaxyData.searchCommodityMarkets({
        commodity: requiredQuery(url, 'commodity'),
        includeFleetCarriers: url.searchParams.get('fleetCarriers') === 'true',
        intent,
        maxDaysAgo: boundedQueryInteger(url, 'maxDaysAgo', 30, 1, 365),
        maxDistance: boundedQueryInteger(url, 'maxDistance', 100, 1, 500),
        minVolume: boundedQueryInteger(url, 'minVolume', 1, 1, Number.MAX_SAFE_INTEGER),
        systemName: requiredQuery(url, 'system')
      }, boundedQueryInteger(url, 'limit', 20, 1, 100)))
      return
    }

    if (request.method === 'GET' && url.pathname === '/api/exploration/ledger') {
      this.writeJson(response, 200, this.options.explorationData.getLedger())
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/exploration/biological-completion') {
      const input = ExplorationManualCompletionRequestSchema.parse(await readJsonBody(request))
      if (!this.options.explorationData.setBiologicalSignalManualCompletion(
        input.bodyKey,
        input.signalKey,
        input.completed
      )) {
        this.writeJson(response, 404, {
          error: { code: 'exploration_signal_not_found', message: 'Exploration signal not found.' }
        })
        return
      }
      this.writeJson(response, 200, { ok: true })
      return
    }

    if (request.method === 'GET' && url.pathname === '/api/display/stream') {
      this.openDisplayStream(request, response)
      return
    }

    if (request.method === 'GET' && url.pathname === '/api/engineering/engineers') {
      this.writeJson(response, 200, this.options.engineering.getEngineers())
      return
    }

    if (request.method === 'GET' && url.pathname === '/api/engineering/materials') {
      const category = url.searchParams.get('category')
      if (category !== null && !isEngineeringMaterialCategory(category)) {
        this.writeJson(response, 400, {
          error: { code: 'invalid_material_category', message: `Unknown material category: ${category}.` }
        })
        return
      }
      this.writeJson(response, 200, this.options.engineering.getMaterials(category ?? undefined))
      return
    }

    if (request.method === 'GET' && url.pathname === '/api/engineering/blueprints') {
      this.writeJson(response, 200, this.options.engineering.getBlueprints())
      return
    }

    const engineeringBlueprintMatch = url.pathname.match(/^\/api\/engineering\/blueprints\/([^/]+)$/u)
    if (request.method === 'GET' && engineeringBlueprintMatch) {
      const blueprint = this.options.engineering.getBlueprint(decodeURIComponent(engineeringBlueprintMatch[1]!))
      if (!blueprint) {
        this.writeJson(response, 404, {
          error: { code: 'blueprint_not_found', message: 'Engineering blueprint not found.' }
        })
        return
      }
      this.writeJson(response, 200, blueprint)
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/copilot/chat') {
      await this.handleCopilotChat(request, response)
      return
    }

    if (request.method === 'GET' && url.pathname === '/api/copilot/profiles') {
      if (!this.options.copilotProfiles) {
        this.writeJson(response, 503, { error: { code: 'copilot_unavailable', message: 'Copilot is not configured.' } })
        return
      }
      this.writeJson(response, 200, this.options.copilotProfiles.get())
      return
    }

    if (request.method === 'PUT' && url.pathname === '/api/copilot/profiles/active') {
      if (!this.options.copilotProfiles) {
        this.writeJson(response, 503, { error: { code: 'copilot_unavailable', message: 'Copilot is not configured.' } })
        return
      }
      try {
        const input = CopilotProfileSelectionRequestSchema.parse(await readJsonBody(request))
        this.writeJson(response, 200, this.options.copilotProfiles.select(input.profileId))
      } catch (cause) {
        this.writeJson(response, 400, { error: { code: 'invalid_copilot_profile', message: errorMessage(cause) } })
      }
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/copilot/profiles') {
      if (!this.options.copilotProfiles) {
        this.writeJson(response, 503, { error: { code: 'copilot_unavailable', message: 'Copilot is not configured.' } })
        return
      }
      try {
        const input = CopilotProfileWriteRequestSchema.parse(await readJsonBody(request))
        this.writeJson(response, 201, this.options.copilotProfiles.create(input))
      } catch (cause) {
        this.writeJson(response, 400, { error: { code: 'invalid_copilot_profile', message: errorMessage(cause) } })
      }
      return
    }

    const copilotProfileMatch = url.pathname.match(/^\/api\/copilot\/profiles\/([a-z][a-z0-9_-]*)$/u)
    if (request.method === 'GET' && copilotProfileMatch) {
      if (!this.options.copilotProfiles) {
        this.writeJson(response, 503, { error: { code: 'copilot_unavailable', message: 'Copilot is not configured.' } })
        return
      }
      try {
        this.writeJson(response, 200, this.options.copilotProfiles.getDocument(copilotProfileMatch[1]!))
      } catch (cause) {
        this.writeJson(response, 404, { error: { code: 'copilot_profile_not_found', message: errorMessage(cause) } })
      }
      return
    }

    if (request.method === 'PUT' && copilotProfileMatch) {
      if (!this.options.copilotProfiles) {
        this.writeJson(response, 503, { error: { code: 'copilot_unavailable', message: 'Copilot is not configured.' } })
        return
      }
      try {
        const input = CopilotProfileWriteRequestSchema.parse(await readJsonBody(request))
        this.writeJson(response, 200, this.options.copilotProfiles.update(copilotProfileMatch[1]!, input))
      } catch (cause) {
        this.writeJson(response, 400, { error: { code: 'invalid_copilot_profile', message: errorMessage(cause) } })
      }
      return
    }

    if (request.method === 'GET' && url.pathname === '/api/copilot/voice-host') {
      this.writeJson(response, 200, this.options.copilotVoiceHost.snapshot())
      return
    }

    if (request.method === 'GET' && url.pathname === '/api/copilot/voice-host/stream') {
      this.openCopilotVoiceHostStatusStream(request, response)
      return
    }

    if (request.method === 'GET' && url.pathname === '/api/copilot/voice-host/commands/stream') {
      const hostId = url.searchParams.get('hostId')?.trim()
      if (!hostId) {
        this.writeJson(response, 400, {
          error: { code: 'voice_host_id_required', message: 'A voice host ID is required.' }
        })
        return
      }
      this.openCopilotVoiceHostCommandStream(request, response, hostId)
      return
    }

    if (request.method === 'PUT' && url.pathname === '/api/copilot/voice-host') {
      try {
        const heartbeat = CopilotVoiceHostHeartbeatSchema.parse(await readJsonBody(request))
        this.writeJson(response, 200, this.options.copilotVoiceHost.heartbeat(heartbeat))
      } catch (cause) {
        this.writeJson(response, 400, {
          error: { code: 'invalid_voice_host_status', message: errorMessage(cause) }
        })
      }
      return
    }

    if (request.method === 'DELETE' && url.pathname === '/api/copilot/voice-host') {
      const hostId = url.searchParams.get('hostId')?.trim()
      this.writeJson(response, 200, hostId
        ? this.options.copilotVoiceHost.release(hostId)
        : this.options.copilotVoiceHost.snapshot())
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/copilot/voice-host/desired-state') {
      try {
        const input = CopilotVoiceHostDesiredStateRequestSchema.parse(await readJsonBody(request))
        this.writeJson(response, 202, {
          accepted: true,
          command: this.options.copilotVoiceHost.request(input.connected)
        })
      } catch (cause) {
        this.writeJson(response, 409, {
          error: { code: 'voice_host_unavailable', message: errorMessage(cause) }
        })
      }
      return
    }

    if (request.method === 'GET' && url.pathname === '/api/copilot/realtime/audio-processing') {
      if (!this.requireRealtime(response)) return
      const profileId = url.searchParams.get('profileId')?.trim() || undefined
      this.writeJson(response, 200, {
        audioProcessing: this.options.copilotRealtime!.audioProcessing(profileId)
      })
      return
    }

    if (request.method === 'GET' && url.pathname === '/api/copilot/realtime/context') {
      if (!this.requireRealtime(response)) return
      this.writeJson(response, 200, this.options.copilotRealtime!.context())
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/copilot/realtime/token') {
      if (!this.requireRealtime(response)) return
      try {
        const input = CopilotRealtimeTokenRequestSchema.parse(await readJsonBody(request))
        this.writeJson(response, 200, await this.options.copilotRealtime!.createToken(input))
      } catch (cause) {
        this.writeJson(response, 502, realtimeError(cause, 'realtime_token_failed'))
      }
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/copilot/realtime/tool') {
      if (!this.requireRealtime(response)) return
      try {
        const input = CopilotRealtimeToolRequestSchema.parse(await readJsonBody(request))
        const controller = new AbortController()
        const abort = (): void => {
          if (!response.writableEnded) controller.abort(new DOMException('Client disconnected.', 'AbortError'))
        }
        response.once('close', abort)
        try {
          this.writeJson(
            response,
            200,
            { result: serializeToolOutput(await this.options.copilotRealtime!.executeTool(input, controller.signal)) }
          )
        } finally {
          response.off('close', abort)
        }
      } catch (cause) {
        this.writeJson(response, 400, realtimeError(cause, 'realtime_tool_failed'))
      }
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/copilot/realtime/turn') {
      if (!this.requireRealtime(response)) return
      try {
        const input = CopilotRealtimeTurnRequestSchema.parse(await readJsonBody(request))
        await this.options.copilotRealtime!.persistTurn(input)
        this.options.copilotConversationEvents.publish(completedConversationEvent(input))
        this.writeJson(response, 200, { conversationId: input.conversationId })
      } catch (cause) {
        this.writeJson(response, 400, realtimeError(cause, 'realtime_turn_failed'))
      }
      return
    }

    const copilotConversationStreamMatch = url.pathname.match(/^\/api\/copilot\/conversations\/([^/]+)\/stream$/u)
    if (request.method === 'GET' && copilotConversationStreamMatch) {
      this.openCopilotConversationStream(
        request,
        response,
        decodeURIComponent(copilotConversationStreamMatch[1]!)
      )
      return
    }

    const copilotConversationEventMatch = url.pathname.match(/^\/api\/copilot\/conversations\/([^/]+)\/events$/u)
    if (request.method === 'POST' && copilotConversationEventMatch) {
      try {
        const conversationId = decodeURIComponent(copilotConversationEventMatch[1]!)
        const event = CopilotConversationEventSchema.parse(await readJsonBody(request))
        if (event.conversationId !== conversationId) {
          throw new Error('Conversation event route and payload do not match.')
        }
        this.options.copilotConversationEvents.publish(event)
        this.writeJson(response, 202, { accepted: true })
      } catch (cause) {
        this.writeJson(response, 400, {
          error: {
            code: 'invalid_copilot_conversation_event',
            message: cause instanceof Error ? cause.message : 'Invalid Copilot conversation event.'
          }
        })
      }
      return
    }

    const copilotConversationMatch = url.pathname.match(/^\/api\/copilot\/conversations\/([^/]+)$/u)
    if (request.method === 'GET' && copilotConversationMatch) {
      await this.handleCopilotHistory(response, decodeURIComponent(copilotConversationMatch[1]!))
      return
    }

    if (request.method === 'GET' && url.pathname === '/api/control-layout') {
      this.writeJson(response, 200, this.options.controlGridLayouts.getLayout())
      return
    }

    if (request.method === 'GET' && url.pathname === '/api/settings/modules') {
      this.writeJson(response, 200, this.options.systemSettings.loadOrCreate().modules)
      return
    }

    if (request.method === 'PUT' && url.pathname === '/api/settings/modules') {
      try {
        const modules = PhoenixModulesSchema.parse(await readJsonBody(request))
        const settings = this.options.systemSettings.loadOrCreate()
        this.options.systemSettings.save({ ...settings, modules })
        this.writeJson(response, 200, modules)
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : 'Invalid module settings.'
        this.writeJson(response, 400, { error: { code: 'invalid_module_settings', message } })
      }
      return
    }

    if (request.method === 'GET' && url.pathname === '/api/macros') {
      this.writeJson(response, 200, this.options.macros.getLibrary())
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/macros') {
      try {
        this.writeJson(response, 200, this.options.macros.save(MacroDefinitionSchema.parse(await readJsonBody(request))))
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : 'Invalid macro.'
        this.writeJson(response, 400, { error: { code: 'invalid_macro', message } })
      }
      return
    }

    const macroMatch = url.pathname.match(/^\/api\/macros\/([a-z][a-z0-9-]*)$/u)
    if (request.method === 'DELETE' && macroMatch && macroMatch[1] !== 'playback') {
      this.options.macros.delete(macroMatch[1]!)
      this.writeJson(response, 200, { deleted: true })
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/macros/recordings') {
      try {
        this.requireMacroModule()
        const input = StartMacroRecordingRequestSchema.parse(await readJsonBody(request))
        this.writeJson(response, 200, this.options.macros.startRecording(input.clientId))
      } catch (cause) {
        this.writeMacroError(response, cause)
      }
      return
    }

    const recordingMatch = url.pathname.match(/^\/api\/macros\/recordings\/([^/]+)\/(action|stop|cancel)$/u)
    if (request.method === 'POST' && recordingMatch) {
      try {
        this.requireMacroModule()
        const recordingId = decodeURIComponent(recordingMatch[1]!)
        const operation = recordingMatch[2]
        const body = await readJsonBody(request)
        if (operation === 'action') {
          this.writeJson(response, 200, await this.options.macros.recordAction(
            recordingId,
            RecordMacroActionRequestSchema.parse(body)
          ))
        } else {
          const input = StartMacroRecordingRequestSchema.parse(body)
          if (operation === 'stop') {
            this.writeJson(response, 200, this.options.macros.stopRecording(recordingId, input.clientId))
          } else {
            this.options.macros.cancelRecording(recordingId, input.clientId)
            this.writeJson(response, 200, { cancelled: true })
          }
        }
      } catch (cause) {
        this.writeMacroError(response, cause)
      }
      return
    }

    const playbackMatch = url.pathname.match(/^\/api\/macros\/([^/]+)\/playback$/u)
    if (request.method === 'POST' && playbackMatch) {
      try {
        this.requireMacroModule()
        this.writeJson(response, 200, await this.options.macros.execute(decodeURIComponent(playbackMatch[1]!), 'ui'))
      } catch (cause) {
        this.writeMacroError(response, cause)
      }
      return
    }

    if (request.method === 'GET' && url.pathname === '/api/macros/playback') {
      this.writeJson(response, 200, { playback: this.options.macros.getPlayback() })
      return
    }

    if (request.method === 'DELETE' && url.pathname === '/api/macros/playback') {
      this.writeJson(response, 200, { playback: this.options.macros.abortPlayback() })
      return
    }

    if (request.method === 'PUT' && url.pathname === '/api/control-layout') {
      try {
        this.writeJson(
          response,
          200,
          this.options.controlGridLayouts.saveLayout(
            ControlGridLayoutSchema.parse(await readJsonBody(request))
          )
        )
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : 'Invalid control layout.'
        this.writeJson(response, 400, {
          error: { code: 'invalid_control_layout', message }
        })
      }
      return
    }

    if (request.method === 'GET' && ['/api/actions', '/api/developer/actions'].includes(url.pathname)) {
      this.writeJson(response, 200, this.options.gameActions.getCatalog())
      return
    }

    if (request.method === 'GET' && url.pathname === '/api/commands') {
      this.writeJson(response, 200, this.options.commands.getCatalog())
      return
    }

    if (request.method === 'GET' && url.pathname === '/api/commands/snapshot') {
      this.writeJson(response, 200, this.options.commandCatalogue.getSnapshot())
      return
    }

    if (request.method === 'GET' && url.pathname === '/api/numpad') {
      this.writeJson(response, 200, this.options.numpad.getSnapshot())
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/numpad/execute') {
      try {
        this.writeJson(response, 200, await this.options.numpad.execute(await readJsonBody(request)))
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : 'Invalid numpad request.'
        this.writeJson(response, 400, { error: { code: 'invalid_numpad_request', message } })
      }
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/commands/execute') {
      try {
        const result = await this.options.commands.execute(
          ExecuteCommandRequestSchema.parse(await readJsonBody(request)),
          'ui'
        )
        this.writeJson(response, 200, result)
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : 'Invalid command request.'
        this.writeJson(response, 400, { error: { code: 'invalid_command_request', message } })
      }
      return
    }

    if (request.method === 'GET' && url.pathname === '/api/developer/catalogue') {
      this.writeJson(response, 200, this.options.catalogueDiagnostics.getDiagnostics())
      return
    }

    if (request.method === 'GET' && url.pathname === '/api/catalogue/ships') {
      this.writeJson(response, 200, this.options.catalogueDiagnostics.getShips())
      return
    }

    if (request.method === 'GET' && url.pathname === '/api/developer/elite-status') {
      this.writeJson(response, 200, this.options.eliteStatusDiagnostics.getDiagnostics())
      return
    }

    if (request.method === 'GET' && url.pathname === '/api/developer/elite-journal') {
      this.writeJson(response, 200, this.options.eliteJournalDiagnostics.getDiagnostics())
      return
    }

    if (
      request.method === 'POST' &&
      ['/api/actions/execute', '/api/developer/actions/execute'].includes(url.pathname)
    ) {
      try {
        const origin = url.pathname.startsWith('/api/developer/') ? 'developer' : 'ui'
        const result = await this.options.gameActions.execute(await readJsonBody(request), origin)
        this.writeJson(response, 200, result)
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : 'Invalid action request.'
        this.writeJson(response, 400, {
          error: { code: 'invalid_action_request', message }
        })
      }
      return
    }

    if (url.pathname.startsWith('/api/')) {
      this.writeJson(response, 404, {
        error: { code: 'not_found', message: `No PHOENIX endpoint exists at ${url.pathname}.` }
      })
      return
    }

    this.serveWebAsset(url.pathname, response)
  }

  private requireMacroModule (): void {
    if (!this.options.systemSettings.loadOrCreate().modules.macros.enabled) {
      throw new Error('Macro module is disabled.')
    }
  }

  private writeMacroError (response: ServerResponse, cause: unknown): void {
    const message = cause instanceof Error ? cause.message : 'Macro operation failed.'
    this.writeJson(response, 400, { error: { code: 'macro_operation_failed', message } })
  }

  private openRuntimeStateStream (request: IncomingMessage, response: ServerResponse): void {
    response.writeHead(200, {
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'content-type': 'text/event-stream; charset=utf-8'
    })
    response.flushHeaders()
    this.eventStreams.add(response)

    const send = (state: RuntimeState): void => {
      response.write(`event: runtime-state\ndata: ${JSON.stringify(state)}\n\n`)
    }
    const unsubscribe = this.options.runtimeStateUpdates.subscribe(send)
    let closed = false
    const close = (): void => {
      if (closed) return
      closed = true
      unsubscribe()
      this.eventStreams.delete(response)
    }

    request.once('close', close)
    response.once('close', close)
    send(this.options.runtimeState.getCurrent())
  }

  private openPhoenixEventStream (
    request: IncomingMessage,
    response: ServerResponse,
    conversationId: string
  ): void {
    response.writeHead(200, {
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'content-type': 'text/event-stream; charset=utf-8'
    })
    response.flushHeaders()
    this.phoenixEventStreams.add(response)
    const send = (event: string, payload: unknown): void => writeSse(response, event, payload)
    const unsubscribers = [
      this.options.runtimeStateUpdates.subscribe(state => send('runtime-state', state)),
      this.options.activityLog.subscribe(entry => send('activity-entry', entry)),
      this.options.displayCommands.subscribe(command => send('display-command', command)),
      this.options.navigationRouteUpdates.subscribe(route => send('navigation-route', route)),
      this.options.commandCatalogue.subscribe(snapshot => send('command-catalogue', {
        revision: snapshot.revision,
        generatedAt: snapshot.generatedAt
      })),
      ...(this.options.copilotProfiles
        ? [this.options.copilotProfiles.subscribe(profiles => send('copilot-profiles', profiles))]
        : []),
      this.options.copilotVoiceHost.subscribeStatus(snapshot => send('voice-host', snapshot)),
      this.options.copilotVoiceHost.subscribeCommands(command => send('voice-host-command', command)),
      this.options.copilotConversationEvents.subscribe(event => {
        if (event.conversationId === conversationId) send('conversation-event', event)
      })
    ]
    send('runtime-state', this.options.runtimeState.getCurrent())
    send('navigation-route', this.options.navigationData.getRoute())
    const commandCatalogue = this.options.commandCatalogue.getSnapshot()
    send('command-catalogue', {
      revision: commandCatalogue.revision,
      generatedAt: commandCatalogue.generatedAt
    })
    send('voice-host', this.options.copilotVoiceHost.snapshot())
    if (this.options.copilotProfiles) send('copilot-profiles', this.options.copilotProfiles.get())
    for (const event of this.options.copilotConversationEvents.active(conversationId)) {
      send('conversation-event', event)
    }
    let closed = false
    const close = (): void => {
      if (closed) return
      closed = true
      for (const unsubscribe of unsubscribers) unsubscribe()
      this.phoenixEventStreams.delete(response)
    }
    request.once('close', close)
    response.once('close', close)
    response.write(': connected\n\n')
  }

  private openActivityStream (request: IncomingMessage, response: ServerResponse): void {
    response.writeHead(200, {
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'content-type': 'text/event-stream; charset=utf-8'
    })
    response.flushHeaders()
    this.activityStreams.add(response)
    const unsubscribe = this.options.activityLog.subscribe(entry => {
      response.write(`event: activity-entry\ndata: ${JSON.stringify(entry)}\n\n`)
    })
    let closed = false
    const close = (): void => {
      if (closed) return
      closed = true
      unsubscribe()
      this.activityStreams.delete(response)
    }
    request.once('close', close)
    response.once('close', close)
    response.write(': connected\n\n')
  }

  private openDisplayStream (request: IncomingMessage, response: ServerResponse): void {
    response.writeHead(200, {
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'content-type': 'text/event-stream; charset=utf-8'
    })
    response.flushHeaders()
    this.displayStreams.add(response)
    const unsubscribe = this.options.displayCommands.subscribe(command => {
      response.write(`event: display-command\ndata: ${JSON.stringify(command)}\n\n`)
    })
    let closed = false
    const close = (): void => {
      if (closed) return
      closed = true
      unsubscribe()
      this.displayStreams.delete(response)
    }
    request.once('close', close)
    response.once('close', close)
    response.write(': connected\n\n')
  }

  private openCopilotConversationStream (
    request: IncomingMessage,
    response: ServerResponse,
    conversationId: string
  ): void {
    response.writeHead(200, {
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'content-type': 'text/event-stream; charset=utf-8'
    })
    response.flushHeaders()
    this.copilotConversationStreams.add(response)
    const unsubscribe = this.options.copilotConversationEvents.subscribe(event => {
      if (event.conversationId === conversationId) writeSse(response, 'conversation-event', event)
    })
    for (const event of this.options.copilotConversationEvents.active(conversationId)) {
      writeSse(response, 'conversation-event', event)
    }
    let closed = false
    const close = (): void => {
      if (closed) return
      closed = true
      unsubscribe()
      this.copilotConversationStreams.delete(response)
    }
    request.once('close', close)
    response.once('close', close)
    response.write(': connected\n\n')
  }

  private openCopilotVoiceHostStatusStream (request: IncomingMessage, response: ServerResponse): void {
    this.openVoiceHostStream(request, response, send => {
      const unsubscribe = this.options.copilotVoiceHost.subscribeStatus(snapshot => send('voice-host', snapshot))
      send('voice-host', this.options.copilotVoiceHost.snapshot())
      return unsubscribe
    })
  }

  private openCopilotVoiceHostCommandStream (
    request: IncomingMessage,
    response: ServerResponse,
    hostId: string
  ): void {
    this.openVoiceHostStream(request, response, send => (
      this.options.copilotVoiceHost.subscribeCommands(command => {
        if (command.hostId === hostId) send('voice-host-command', command)
      })
    ))
  }

  private openVoiceHostStream (
    request: IncomingMessage,
    response: ServerResponse,
    subscribe: (send: (event: string, payload: unknown) => void) => () => void
  ): void {
    response.writeHead(200, {
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'content-type': 'text/event-stream; charset=utf-8'
    })
    response.flushHeaders()
    this.copilotVoiceHostStreams.add(response)
    const unsubscribe = subscribe((event, payload) => writeSse(response, event, payload))
    let closed = false
    const close = (): void => {
      if (closed) return
      closed = true
      unsubscribe()
      this.copilotVoiceHostStreams.delete(response)
    }
    request.once('close', close)
    response.once('close', close)
    response.write(': connected\n\n')
  }

  private async handleCopilotChat (
    request: IncomingMessage,
    response: ServerResponse
  ): Promise<void> {
    if (!this.options.copilot) {
      this.writeJson(response, 503, {
        error: {
          code: 'copilot_unavailable',
          message: 'Set PHOENIX_OPENAI_API_KEY or OPENAI_API_KEY to enable the Copilot.'
        }
      })
      return
    }

    let input: CopilotTextRequest
    try {
      input = CopilotChatRequestSchema.parse(await readJsonBody(request))
    } catch (cause) {
      this.writeJson(response, 400, {
        error: {
          code: 'invalid_copilot_request',
          message: cause instanceof Error ? cause.message : 'Invalid Copilot request.'
        }
      })
      return
    }

    if (request.headers.accept?.includes('text/event-stream') === true) {
      await this.streamCopilotChat(input, response)
      return
    }

    try {
      const result = await this.options.copilot.run(input)
      this.writeJson(response, 200, {
        conversationId: result.chatId,
        finishReason: result.finishReason,
        text: result.text,
        usage: result.usage
      })
    } catch (cause) {
      this.writeJson(response, copilotErrorStatus(cause), {
        error: serializeCopilotError(cause)
      })
    }
  }

  private requireRealtime (response: ServerResponse): boolean {
    if (this.options.copilotRealtime) return true
    this.writeJson(response, 503, {
      error: {
        code: 'copilot_realtime_unavailable',
        message: 'Set PHOENIX_OPENAI_API_KEY or OPENAI_API_KEY to enable Realtime voice.'
      }
    })
    return false
  }

  private async handleCopilotHistory (
    response: ServerResponse,
    conversationId: string
  ): Promise<void> {
    if (!this.options.copilot) {
      this.writeJson(response, 503, {
        error: { code: 'copilot_unavailable', message: 'The Copilot is not configured.' }
      })
      return
    }
    try {
      this.writeJson(response, 200, {
        conversationId,
        messages: await this.options.copilot.getHistory(conversationId)
      })
    } catch (cause) {
      this.writeJson(response, copilotErrorStatus(cause), {
        error: serializeCopilotError(cause)
      })
    }
  }

  private async streamCopilotChat (
    input: CopilotTextRequest,
    response: ServerResponse
  ): Promise<void> {
    response.writeHead(200, {
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'content-type': 'text/event-stream; charset=utf-8'
    })
    response.flushHeaders()
    response.write(': PHOENIX Copilot stream\n\n')
    this.eventStreams.add(response)
    const controller = new AbortController()
    const abort = (): void => controller.abort(new DOMException('Client disconnected.', 'AbortError'))
    response.once('close', abort)
    const heartbeat = setInterval(() => {
      if (!response.destroyed) response.write(': keepalive\n\n')
    }, 15_000)

    const turnId = input.turnId ?? randomUUID()
    const clientId = input.clientId ?? `server-${turnId}`
    let conversationId = input.conversationId
    let assistantText = ''
    let started = false
    const publish = (event: CopilotConversationEventPayload): void => {
      if (!conversationId) return
      this.options.copilotConversationEvents.publish({
        ...event,
        clientId,
        conversationId,
        occurredAt: new Date().toISOString(),
        turnId
      } as CopilotConversationEvent)
    }

    try {
      for await (const event of this.options.copilot!.stream(input, { signal: controller.signal })) {
        if (event.type === 'run.started') {
          conversationId = event.chatId
          if (!started) {
            started = true
            publish({ source: 'text', type: 'turn.started', userText: input.message })
          }
        } else if (event.type === 'text.reset') {
          assistantText = ''
          publish({ final: false, text: assistantText, type: 'assistant.transcript' })
        } else if (event.type === 'text.delta') {
          assistantText += event.delta
          publish({ final: false, text: assistantText, type: 'assistant.transcript' })
        } else if (event.type === 'tool.call') {
          publish({ callId: event.call.id, name: event.call.name, status: 'calling', type: 'tool.status' })
        } else if (event.type === 'tool.result') {
          publish({ callId: event.callId, status: event.status, type: 'tool.status' })
        } else if (event.type === 'run.completed') {
          assistantText = event.result.text
          publish({ final: true, text: assistantText, type: 'assistant.transcript' })
          publish({ type: 'turn.completed' })
        }
        writeCopilotStreamEvent(response, event)
      }
    } catch (cause) {
      publish({
        message: cause instanceof Error ? cause.message : 'Copilot request failed.',
        type: 'turn.failed'
      })
      if (!response.destroyed) writeSse(response, 'error', { error: serializeCopilotError(cause) })
    } finally {
      clearInterval(heartbeat)
      response.off('close', abort)
      this.eventStreams.delete(response)
      if (!response.destroyed) response.end()
    }
  }

  private serveWebAsset (pathname: string, response: ServerResponse): void {
    const root = resolve(this.options.webRoot)
    const requested = pathname === '/' ? 'index.html' : pathname.slice(1)
    const candidate = resolve(root, normalize(requested))
    const candidateRelativePath = relative(root, candidate)
    const isInsideRoot = candidateRelativePath !== '..' && !candidateRelativePath.startsWith(`..${sep}`) && !isAbsolute(candidateRelativePath)
    const file = isInsideRoot && existsSync(candidate) && statSync(candidate).isFile()
      ? candidate
      : join(root, 'index.html')

    if (!existsSync(file)) {
      this.writeJson(response, 404, {
        error: {
          code: 'web_not_built',
          message: 'PHOENIX web assets are not built. Run npm run dev or npm run build.'
        }
      })
      return
    }

    response.writeHead(200, {
      'cache-control': file.endsWith('index.html') ? 'no-cache' : 'public, max-age=3600',
      'content-type': CONTENT_TYPES[extname(file)] ?? 'application/octet-stream'
    })
    createReadStream(file).pipe(response)
  }

  private writeJson (response: ServerResponse, status: number, payload: unknown): void {
    const body = JSON.stringify(payload)
    response.writeHead(status, {
      'cache-control': 'no-store',
      'content-length': Buffer.byteLength(body),
      'content-type': 'application/json; charset=utf-8'
    })
    response.end(body)
  }
}

function realtimeError (cause: unknown, code: string): unknown {
  return {
    error: {
      code,
      message: cause instanceof Error ? cause.message : 'Realtime Copilot request failed.'
    }
  }
}

function errorMessage (cause: unknown): string {
  return cause instanceof Error ? cause.message : 'Unknown PHOENIX error.'
}

function isRecord (value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function completedConversationEvent (input: {
  clientId?: string
  conversationId: string
  turnId: string
}): CopilotConversationEvent {
  return {
    clientId: input.clientId ?? `server-${input.turnId}`,
    conversationId: input.conversationId,
    occurredAt: new Date().toISOString(),
    turnId: input.turnId,
    type: 'turn.completed'
  }
}

async function readJsonBody (request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  let length = 0

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    length += buffer.length
    if (length > 64 * 1024) throw new Error('Request body exceeds 64 KiB.')
    chunks.push(buffer)
  }

  if (chunks.length === 0) throw new Error('Request body is empty.')
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown
}

function writeCopilotStreamEvent (response: ServerResponse, event: AiStreamEvent): void {
  switch (event.type) {
    case 'run.started':
      writeSse(response, 'started', { conversationId: event.chatId })
      break
    case 'run.retrying':
      writeSse(response, 'retrying', { attempt: event.attempt })
      break
    case 'text.reset':
      writeSse(response, 'reset', {})
      break
    case 'text.delta':
      writeSse(response, 'delta', { delta: event.delta })
      break
    case 'tool.call':
      writeSse(response, 'tool', {
        callId: event.call.id,
        name: event.call.name,
        status: 'calling'
      })
      break
    case 'tool.result':
      writeSse(response, 'tool', { callId: event.callId, status: event.status })
      break
    case 'run.completed':
      writeSse(response, 'completed', {
        conversationId: event.result.chatId,
        finishReason: event.result.finishReason,
        text: event.result.text,
        usage: event.result.usage
      })
      break
  }
}

function writeSse (response: ServerResponse, event: string, payload: unknown): void {
  response.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`)
}

function serializeCopilotError (cause: unknown): unknown {
  if (cause instanceof AiError) return serializeAiError(cause)
  return {
    code: 'copilot_request_failed',
    message: cause instanceof Error ? cause.message : 'The Copilot request failed.',
    retryable: false
  }
}

function copilotErrorStatus (cause: unknown): number {
  if (!(cause instanceof AiError)) return 500
  switch (cause.category) {
    case 'invalid_request': return 400
    case 'authentication':
    case 'authorization': return 502
    case 'persistence_conflict': return 409
    case 'rate_limit': return 429
    case 'timeout': return 504
    default: return 502
  }
}

function isEngineeringMaterialCategory (
  candidate: string
): candidate is 'raw' | 'manufactured' | 'encoded' | 'xeno' {
  return ['raw', 'manufactured', 'encoded', 'xeno'].includes(candidate)
}

function requiredQuery (url: URL, name: string): string {
  const value = url.searchParams.get(name)?.trim()
  if (!value) throw new Error(`${name} is required.`)
  return value
}

function boundedQueryInteger (url: URL, name: string, fallback: number, minimum: number, maximum: number): number {
  const raw = url.searchParams.get(name)
  if (raw === null) return fallback
  const value = Number.parseInt(raw, 10)
  if (!Number.isSafeInteger(value)) throw new Error(`${name} must be an integer.`)
  return Math.min(maximum, Math.max(minimum, value))
}

function optionalPadSize (value: string | null): 'small' | 'medium' | 'large' | null {
  if (value === null || value === '') return null
  if (value === 'small' || value === 'medium' || value === 'large') return value
  throw new Error('pad must be small, medium, or large.')
}
