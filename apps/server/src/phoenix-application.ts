import { isAbsolute, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { DisplayCommand, GameEventEnvelope, NavigationRoute, RuntimeState } from '@phoenix/contracts'
import { ToolRegistry } from '@judus/llm-client'
import {
  EliteDataDirectoryLocator,
  EliteBindingsDirectoryLocator,
  EliteKeyboardBindingResolver,
  EliteInventoryFileSource,
  EliteJournalFileSource,
  EliteJournalHistoryBackfill,
  EliteNavigationRouteFileSource,
  EliteStatusFileSource
} from '@phoenix/elite'
import { CatalogueShipLoadoutEnricher } from './application/catalogue-ship-loadout-enricher.js'
import { CopilotConversationEventService } from './application/copilot-conversation-event-service.js'
import { CopilotVoiceHostCoordinator } from './application/copilot-voice-host-coordinator.js'
import type { CopilotProfiles } from './application/copilot-profile-service.js'
import { CatalogueDiagnosticsService } from './application/catalogue-diagnostics-service.js'
import { CachedSystemCartographyService } from './application/cached-system-cartography-service.js'
import { CartographyObservationIngestionService } from './application/cartography-observation-ingestion-service.js'
import { DefaultNavigationQuery } from './application/default-navigation-query.js'
import { DefaultSystemDetailsQuery } from './application/default-system-details-query.js'
import { DefaultGameActionGateway } from './application/default-game-action-gateway.js'
import { DefaultCommandDispatcher } from './application/command-dispatcher.js'
import { DefaultCommandRegistry, PHOENIX_NAVIGATION_DESTINATIONS } from './application/default-command-registry.js'
import { CommandCatalogueService } from './application/command-catalogue-service.js'
import { DefaultNumpadCommands, NumpadTreeProjector } from './application/numpad-command-service.js'
import { DefaultRuntimeStateProjector } from './application/default-runtime-state-projector.js'
import { GameActionService } from './application/game-action-service.js'
import { createPhoenixMcpTools } from './application/phoenix-mcp-tools.js'
import { StatefulGameActionService } from './application/stateful-game-action-service.js'
import { EliteJournalIngestionService } from './application/elite-journal-ingestion-service.js'
import { EliteJournalDiagnosticsService } from './application/elite-journal-diagnostics-service.js'
import { EliteInventoryIngestionService } from './application/elite-inventory-ingestion-service.js'
import { EliteStatusIngestionService } from './application/elite-status-ingestion-service.js'
import { GameEventIngestionService } from './application/game-event-ingestion-service.js'
import { HealthService } from './application/health-service.js'
import { ActivityLogService } from './application/activity-log-service.js'
import { LoggedGameActions } from './application/logged-game-actions.js'
import { DisplayCommandService } from './application/display-command-service.js'
import { NavigationDataService } from './application/navigation-data-service.js'
import { EngineeringDataService } from './application/engineering-data-service.js'
import { ExplorationDataService } from './application/exploration-data-service.js'
import { DefaultCommanderEngineersQuery } from './application/default-commander-engineers-query.js'
import { DefaultStationMarketQuery } from './application/default-station-market-query.js'
import { GalnetNewsService } from './application/galnet-news-service.js'
import { MissionDataService } from './application/mission-data-service.js'
import { CommunicationDataService } from './application/communication-data-service.js'
import { FleetDataService } from './application/fleet-data-service.js'
import { DefaultExplorationBodyQuery } from './application/default-exploration-body-query.js'
import type { CopilotText } from './application/copilot-text-service.js'
import type { CopilotRealtime } from './application/copilot-realtime-service.js'
import type { GameActionBindingResolver, InputBackend } from './domain/game-actions.js'
import type { CartographySource } from './domain/cartography.js'
import type { ShipyardSearchSource, StationSearchSource, StationStockSource } from './domain/station-market.js'
import type { GalnetSource } from './domain/galnet.js'
import type { ControlGridLayoutRepository, SystemSettingsRepository } from './domain/system-configuration.js'
import type { MacroRepository } from './domain/macros.js'
import type { CommandCatalogueChange } from './domain/commands.js'
import { DefaultGameActionCatalog } from './infrastructure/default-game-action-catalog.js'
import { InMemoryRuntimeStateStore } from './infrastructure/in-memory-runtime-state-store.js'
import { InMemoryNavigationRouteStore } from './infrastructure/in-memory-navigation-route-store.js'
import { InMemoryControlGridLayoutRepository } from './infrastructure/in-memory-control-grid-layout-repository.js'
import { InMemorySystemSettingsRepository } from './infrastructure/json-system-configuration.js'
import { InMemoryMacroRepository } from './infrastructure/macro-repositories.js'
import {
  NotifyingControlGridLayoutRepository,
  NotifyingMacroRepository,
  NotifyingSystemSettingsRepository
} from './infrastructure/notifying-command-source-repositories.js'
import { MacroService } from './application/macro-service.js'
import { InProcessPublisher } from './infrastructure/in-process-publisher.js'
import { PhoenixHttpServer } from './infrastructure/phoenix-http-server.js'
import { RecordingInputBackend } from './infrastructure/recording-input-backend.js'
import { LinuxXdotoolInputBackend } from './infrastructure/linux-xdotool-input-backend.js'
import { SqliteDatabase } from './infrastructure/sqlite-database.js'
import { EdsmCartographySource } from './infrastructure/edsm-cartography-source.js'
import { createConfiguredCopilot } from './infrastructure/configured-copilot.js'
import { PhoenixMcpServer } from './infrastructure/phoenix-mcp-server.js'
import { ArdentStationSearchSource } from './infrastructure/ardent-station-search-source.js'
import { EdsmStationStockSource } from './infrastructure/edsm-station-stock-source.js'
import { SpanshShipyardSearchSource } from './infrastructure/spansh-shipyard-search-source.js'
import { CatalogueSnapshotLoader } from './infrastructure/catalogue-snapshot-loader.js'
import { ApplicationPaths } from './infrastructure/application-paths.js'
import { FrontierGalnetSource } from './infrastructure/frontier-galnet-source.js'
import type { PairingAccessController } from './infrastructure/pairing-access-controller.js'

export interface PhoenixApplicationOptions {
  applicationPaths?: ApplicationPaths
  actionBindingResolver?: GameActionBindingResolver
  accessControl?: PairingAccessController
  cartographySource?: CartographySource
  controlGridLayoutRepository?: ControlGridLayoutRepository
  copilot?: CopilotText | null
  copilotRealtime?: CopilotRealtime | null
  copilotProfiles?: CopilotProfiles | null
  databasePath?: string
  eliteDirectory?: string | null
  engineeringCatalogueDirectory?: string
  eliteBindingsDirectory?: string | null
  host?: string
  galnetSource?: GalnetSource
  inputBackend?: InputBackend
  inputBackendMode?: 'recording' | 'linux-xdotool'
  moduleCataloguePath?: string
  macroRepository?: MacroRepository
  port?: number
  shipCataloguePath?: string
  stationSearchSource?: StationSearchSource
  shipyardSearchSource?: ShipyardSearchSource
  stationStockSource?: StationStockSource
  systemSettingsRepository?: SystemSettingsRepository
  webRoot?: string
}

export class PhoenixApplication {
  private readonly database: SqliteDatabase
  private readonly eventIngestion: GameEventIngestionService
  private readonly journalSource: EliteJournalFileSource
  private readonly journalBackfill: EliteJournalHistoryBackfill
  private readonly inventorySource: EliteInventoryFileSource
  private readonly navigationRouteSource: EliteNavigationRouteFileSource
  private readonly server: PhoenixHttpServer
  private readonly stateStore: InMemoryRuntimeStateStore
  private readonly statusSource: EliteStatusFileSource

  public constructor (options: PhoenixApplicationOptions = {}) {
    const projectRoot = fileURLToPath(new URL('../../../', import.meta.url))
    const paths = options.applicationPaths ?? ApplicationPaths.development(projectRoot)
    const host = options.host ?? process.env.PHOENIX_HOST ?? '0.0.0.0'
    const port = options.port ?? Number(process.env.PHOENIX_PORT ?? 3400)
    const gameEvents = new InProcessPublisher<GameEventEnvelope>()
    const copilotConversationEvents = new CopilotConversationEventService()
    const copilotVoiceHost = new CopilotVoiceHostCoordinator()
    const runtimeStateUpdates = new InProcessPublisher<RuntimeState>()
    const displayCommandUpdates = new InProcessPublisher<DisplayCommand>()
    const commandCatalogueChanges = new InProcessPublisher<CommandCatalogueChange>()
    this.stateStore = new InMemoryRuntimeStateStore()
    this.database = new SqliteDatabase(
      resolveProjectPath(
        projectRoot,
        options.databasePath ?? process.env.PHOENIX_DATABASE_PATH ?? resolve(paths.user.data, 'runtime/phoenix.sqlite')
      )
    )
    const activityLog = new ActivityLogService(this.database)
    const missions = new MissionDataService(this.database)
    const communications = new CommunicationDataService(this.database)
    const engineeringCatalogueDirectory = resolveProjectPath(
      projectRoot,
      options.engineeringCatalogueDirectory ?? process.env.PHOENIX_ENGINEERING_CATALOGUE_PATH ?? resolve(paths.resources.catalogue, 'engineering')
    )
    const customCatalogue = options.shipCataloguePath !== undefined || options.moduleCataloguePath !== undefined ||
      options.engineeringCatalogueDirectory !== undefined || process.env.PHOENIX_SHIP_CATALOGUE_PATH !== undefined ||
      process.env.PHOENIX_MODULE_CATALOGUE_PATH !== undefined || process.env.PHOENIX_ENGINEERING_CATALOGUE_PATH !== undefined
    const bundledCatalogueDirectory = paths.resources.catalogue
    const catalogues = new CatalogueSnapshotLoader().load(
      customCatalogue ? null : cataloguePaths(resolve(paths.user.data, 'runtime/catalogue')),
      {
        directory: engineeringCatalogueDirectory,
        engineeringDirectory: engineeringCatalogueDirectory,
        ships: resolveProjectPath(
          projectRoot,
          options.shipCataloguePath ?? process.env.PHOENIX_SHIP_CATALOGUE_PATH ?? `${bundledCatalogueDirectory}/ships.json`
        ),
        modules: resolveProjectPath(
          projectRoot,
          options.moduleCataloguePath ?? process.env.PHOENIX_MODULE_CATALOGUE_PATH ?? `${bundledCatalogueDirectory}/modules.json`
        )
      }
    )
    const gameCatalogue = catalogues.game
    const engineeringCatalogue = catalogues.engineering
    const fleet = new FleetDataService(
      this.database,
      identifier => gameCatalogue.resolveShip(identifier)?.displayName ?? null
    )
    const projector = new DefaultRuntimeStateProjector(
      this.stateStore,
      runtimeStateUpdates,
      new CatalogueShipLoadoutEnricher(gameCatalogue)
    )
    gameEvents.subscribe(event => {
      projector.project(event)
      activityLog.ingestRuntime(event)
    })
    this.eventIngestion = new GameEventIngestionService(gameEvents)
    const configuredEliteDirectory = options.eliteDirectory === null
      ? null
      : new EliteDataDirectoryLocator({
          explicitDirectory: options.eliteDirectory ?? process.env.PHOENIX_ELITE_DIRECTORY
        }).locate()
    const statusIngestion = new EliteStatusIngestionService(this.eventIngestion)
    const journalIngestion = new EliteJournalIngestionService(this.eventIngestion)
    const cartographyObservationIngestion = new CartographyObservationIngestionService(this.database, this.stateStore)
    const historicalState = new InMemoryRuntimeStateStore()
    const historicalEvents = new InProcessPublisher<GameEventEnvelope>()
    const historicalProjector = new DefaultRuntimeStateProjector(
      historicalState,
      new InProcessPublisher<RuntimeState>()
    )
    historicalEvents.subscribe(event => {
      historicalProjector.project(event)
      activityLog.ingestRuntime(event, 'historical')
    })
    const historicalJournalIngestion = new EliteJournalIngestionService(
      new GameEventIngestionService(historicalEvents)
    )
    const historicalCartographyIngestion = new CartographyObservationIngestionService(
      this.database,
      historicalState
    )
    const inventoryIngestion = new EliteInventoryIngestionService(this.eventIngestion)
    this.journalSource = new EliteJournalFileSource(
      configuredEliteDirectory,
      event => {
        journalIngestion.ingest(event)
        cartographyObservationIngestion.ingest(event)
        missions.ingest(event, 'live-journal')
        communications.ingest(event)
        fleet.ingest(event)
        activityLog.ingestJournal(event)
      }
    )
    this.journalBackfill = new EliteJournalHistoryBackfill(
      configuredEliteDirectory,
      event => {
        historicalJournalIngestion.ingest(event)
        historicalCartographyIngestion.ingest(event)
        missions.ingest(event, 'historical-journal')
        communications.ingest(event)
        fleet.ingest(event)
        activityLog.ingestJournal(event, 'historical')
      },
      this.database
    )
    this.statusSource = new EliteStatusFileSource(
      configuredEliteDirectory,
      status => {
        statusIngestion.ingest(status)
      }
    )
    this.inventorySource = new EliteInventoryFileSource(
      configuredEliteDirectory,
      snapshot => { inventoryIngestion.ingest(snapshot) }
    )
    const navigationRoutes = new InMemoryNavigationRouteStore()
    const navigationRouteUpdates = new InProcessPublisher<NavigationRoute>()
    this.navigationRouteSource = new EliteNavigationRouteFileSource(
      configuredEliteDirectory,
      route => {
        navigationRoutes.replace(route)
        navigationRouteUpdates.publish(route)
      }
    )
    const actionBindingResolver = options.actionBindingResolver ?? new EliteKeyboardBindingResolver(
      locateBindingsDirectory(options, configuredEliteDirectory)
    )
    const actionGateway = new DefaultGameActionGateway(
      new DefaultGameActionCatalog(actionBindingResolver),
      actionBindingResolver,
      options.inputBackend ?? configuredInputBackend(options.inputBackendMode)
    )
    const gameActions = new LoggedGameActions(new GameActionService(actionGateway), activityLog)
    const systemSettings = new NotifyingSystemSettingsRepository(
      options.systemSettingsRepository ?? new InMemorySystemSettingsRepository(),
      commandCatalogueChanges
    )
    const controlGridLayouts = new NotifyingControlGridLayoutRepository(
      options.controlGridLayoutRepository ?? new InMemoryControlGridLayoutRepository(),
      commandCatalogueChanges
    )
    const macroRepository = new NotifyingMacroRepository(
      options.macroRepository ?? new InMemoryMacroRepository(),
      commandCatalogueChanges
    )
    const macros = new MacroService(macroRepository, gameActions)
    const commandRegistry = new DefaultCommandRegistry(
      gameActions,
      PHOENIX_NAVIGATION_DESTINATIONS,
      macroRepository,
      () => systemSettings.loadOrCreate().modules.macros.enabled
    )
    const commandCatalogue = new CommandCatalogueService(commandRegistry, commandCatalogueChanges)
    const commands = new DefaultCommandDispatcher(
      commandCatalogue,
      gameActions,
      PHOENIX_NAVIGATION_DESTINATIONS,
      undefined,
      macros
    )
    const numpad = new DefaultNumpadCommands(
      new NumpadTreeProjector(commandCatalogue, controlGridLayouts, systemSettings),
      commands,
      systemSettings
    )
    const statefulActions = new StatefulGameActionService(gameActions, this.stateStore)
    const cartography = new CachedSystemCartographyService(
      options.cartographySource ?? new EdsmCartographySource(),
      this.database,
      this.stateStore,
      this.database
    )
    const navigation = new DefaultNavigationQuery(navigationRoutes, cartography, this.stateStore)
    const systems = new DefaultSystemDetailsQuery(cartography, this.stateStore)
    const stationMarkets = new DefaultStationMarketQuery(
      options.stationSearchSource ?? new ArdentStationSearchSource(),
      options.stationStockSource ?? new EdsmStationStockSource(),
      options.shipyardSearchSource ?? new SpanshShipyardSearchSource(),
      cartography,
      this.stateStore,
      this.database
    )
    const galnet = new GalnetNewsService(options.galnetSource ?? new FrontierGalnetSource(), this.database)
    const navigationData = new NavigationDataService(cartography, navigationRoutes, this.stateStore)
    const display = new DisplayCommandService(displayCommandUpdates, this.stateStore)
    const engineering = new EngineeringDataService(engineeringCatalogue, this.stateStore)
    const exploration = new DefaultExplorationBodyQuery(this.database, cartography, this.stateStore)
    const explorationData = new ExplorationDataService(this.database, this.database)
    const toolRegistry = new ToolRegistry(createPhoenixMcpTools({
      commands,
      display,
      engineers: new DefaultCommanderEngineersQuery(engineering),
      exploration,
      fleet,
      gameCatalogue,
      navigation,
      markets: stationMarkets,
      missions,
      communications,
      runtimeState: this.stateStore,
      statefulActions,
      stations: stationMarkets,
      systems
    }))
    const mcpServer = new PhoenixMcpServer(toolRegistry)
    const configuredCopilot = options.copilot === undefined && options.copilotRealtime === undefined
      ? createConfiguredCopilot(paths, {
          ...(port > 0 ? { mcpUrl: `http://127.0.0.1:${port}/mcp` } : {}),
          ...(options.accessControl ? { mcpToken: options.accessControl.bearerToken } : {}),
          runtimeState: this.stateStore,
          missions,
          systemSettings,
          tools: toolRegistry
        })
      : undefined
    const copilot = options.copilot === undefined
      ? configuredCopilot?.text
      : options.copilot ?? undefined
    const copilotRealtime = options.copilotRealtime === undefined
      ? configuredCopilot?.realtime
      : options.copilotRealtime ?? undefined
    const copilotProfiles = options.copilotProfiles === undefined
      ? configuredCopilot?.profiles
      : options.copilotProfiles ?? undefined
    this.server = new PhoenixHttpServer({
      accessControl: options.accessControl,
      catalogueDiagnostics: new CatalogueDiagnosticsService(gameCatalogue, this.stateStore),
      commandCatalogue,
      controlGridLayouts,
      copilot,
      copilotProfiles,
      copilotConversationEvents,
      copilotVoiceHost,
      copilotRealtime,
      commands,
      gameActions,
      eliteJournalDiagnostics: new EliteJournalDiagnosticsService(
        this.journalSource,
        this.journalBackfill
      ),
      eliteStatusDiagnostics: this.statusSource,
      healthCheck: new HealthService(this.database),
      host,
      activityLog,
      mcpServer,
      macros,
      missions,
      communications,
      port,
      runtimeState: this.stateStore,
      runtimeStateUpdates,
      systemSettings,
      displayCommands: display,
      engineering,
      explorationData,
      fleet,
      galaxyData: stationMarkets,
      galnet,
      navigationData,
      navigationRouteUpdates,
      numpad,
      webRoot: resolveProjectPath(projectRoot, options.webRoot ?? paths.resources.web)
    })
  }

  public async start (): Promise<{ host: string, port: number }> {
    this.database.initialize()
    try {
      await this.journalSource.start()
      await this.statusSource.start()
      await this.inventorySource.start()
      await this.navigationRouteSource.start()
      const address = await this.server.start()
      void this.journalBackfill.start()
      return address
    } catch (cause) {
      this.journalSource.stop()
      this.statusSource.stop()
      this.inventorySource.stop()
      this.navigationRouteSource.stop()
      this.database.close()
      throw cause
    }
  }

  public async stop (): Promise<void> {
    this.journalSource.stop()
    this.statusSource.stop()
    this.inventorySource.stop()
    this.navigationRouteSource.stop()
    await this.journalBackfill.stop()
    await this.server.stop()
    this.database.close()
  }

  public ingestGameEvent (candidate: unknown): GameEventEnvelope {
    return this.eventIngestion.ingest(candidate)
  }
}

function configuredInputBackend (mode: string | undefined): InputBackend {
  if (!mode || mode === 'recording') return new RecordingInputBackend()
  if (mode === 'linux-xdotool') return new LinuxXdotoolInputBackend()
  throw new Error(`Unsupported PHOENIX input backend: ${mode}.`)
}

function locateBindingsDirectory (
  options: PhoenixApplicationOptions,
  eliteDataDirectory: string | null
): string | null {
  if (options.eliteBindingsDirectory === null) return null
  if (options.eliteDirectory === null && options.eliteBindingsDirectory === undefined) return null
  return new EliteBindingsDirectoryLocator({
    eliteDataDirectory,
    explicitDirectory: options.eliteBindingsDirectory ?? process.env.PHOENIX_ELITE_BINDINGS_DIRECTORY
  }).locate()
}

function resolveProjectPath (projectRoot: string, path: string): string {
  if (path === ':memory:' || isAbsolute(path)) return path
  return resolve(projectRoot, path)
}

function cataloguePaths (directory: string) {
  return {
    directory,
    engineeringDirectory: resolve(directory, 'engineering'),
    ships: resolve(directory, 'ships.json'),
    modules: resolve(directory, 'modules.json')
  }
}
