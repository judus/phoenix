import { randomUUID } from 'node:crypto'
import { isAbsolute, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { CartographyUpdate, CommunicationMessage, DisplayCommand, EngineeringProjectsChanged, GameEventEnvelope, NavigationRoute, PhoenixControlDeckConfiguration, RuntimeState } from '@phoenix/contracts'
import { ControlDeckCommandService, type ControlDeckConfigurationRepository } from 'control-deck/core'
import { ControlDeckIntegration } from 'control-deck/host'
import {
  RecordingKeyboardOutput,
  type KeyboardOutput
} from 'control-deck/adapter-keyboard'
import {
  EliteBindingsDirectoryLocator,
  EliteDangerousCommandAdapter,
  EliteKeyboardBindingResolver,
  type EliteDangerousBindingSource
} from 'control-deck/integration-elite-dangerous'
import {
  EliteDataDirectoryLocator,
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
import { SystemCartographyService } from './application/system-cartography-service.js'
import { CartographyObservationIngestionService } from './application/cartography-observation-ingestion-service.js'
import { DefaultNavigationQuery } from './application/default-navigation-query.js'
import { DefaultSystemDetailsQuery } from './application/default-system-details-query.js'
import { ControlDeckEliteGameActionGateway } from './application/control-deck-elite-game-action-gateway.js'
import { DefaultCommandDispatcher } from './application/command-dispatcher.js'
import { DefaultCommandRegistry, PHOENIX_NAVIGATION_DESTINATIONS } from './application/default-command-registry.js'
import { CommandCatalogueService } from './application/command-catalogue-service.js'
import { createPhoenixControlDeckCommandIntegration } from './application/create-phoenix-control-deck-command-integration.js'
import { DefaultNumpadCommands, NumpadTreeProjector } from './application/numpad-command-service.js'
import { DefaultRuntimeStateProjector } from './application/default-runtime-state-projector.js'
import { GameActionService, type GameActions } from './application/game-action-service.js'
import { createPhoenixMcpTools } from './application/phoenix-mcp-tools.js'
import { DefaultCopilotCapabilityService } from './application/copilot-capability-service.js'
import { CopilotCommands } from './application/copilot-commands.js'
import { CopilotToolRegistry } from './application/copilot-tool-registry.js'
import { StatefulGameActionService } from './application/stateful-game-action-service.js'
import { EliteJournalIngestionService } from './application/elite-journal-ingestion-service.js'
import { EliteJournalProjectionPipeline } from './application/elite-journal-projection-pipeline.js'
import { EliteJournalDiagnosticsService } from './application/elite-journal-diagnostics-service.js'
import { EliteInventoryIngestionService } from './application/elite-inventory-ingestion-service.js'
import { EliteStatusIngestionService } from './application/elite-status-ingestion-service.js'
import { GameEventIngestionService } from './application/game-event-ingestion-service.js'
import { HealthService } from './application/health-service.js'
import { ActivityLogService } from './application/activity-log-service.js'
import { CommanderLogService } from './application/commander-log/commander-log-service.js'
import { DefaultCommanderLogProjector } from './application/commander-log/commander-log-projector.js'
import { CommanderEquipmentService } from './application/commander-equipment-service.js'
import { DefaultCommanderEquipmentCatalogue } from './application/commander-equipment-catalogue.js'
import { PersonalMaterialInventoryService } from './application/personal-material-inventory-service.js'
import { PersonalEquipmentUpgradesService } from './application/personal-equipment-upgrades-service.js'
import { PersonalEquipmentSpecialistsService } from './application/personal-equipment-specialists-service.js'
import { PersonalEquipmentPlannerService } from './application/personal-equipment-planner-service.js'
import { PersonalEquipmentReportService } from './application/personal-equipment-report-service.js'
import { LoggedGameActions } from './application/logged-game-actions.js'
import { DisplayCommandService } from './application/display-command-service.js'
import { NavigationDataService } from './application/navigation-data-service.js'
import { EliteDestinationService } from './application/elite-destination-service.js'
import { EngineeringDataService } from './application/engineering-data-service.js'
import { EngineeringProjectService } from './application/engineering-project-service.js'
import { ExplorationDataService } from './application/exploration-data-service.js'
import { DefaultCommanderEngineersQuery } from './application/default-commander-engineers-query.js'
import { DefaultStationMarketQuery } from './application/default-station-market-query.js'
import { GalnetNewsService } from './application/galnet-news-service.js'
import { MissionDataService } from './application/mission-data-service.js'
import { CommunicationDataService } from './application/communication-data-service.js'
import { LocalTrafficService } from './application/local-traffic-service.js'
import { FleetDataService } from './application/fleet-data-service.js'
import { CachedCartographyStationResolver } from './application/cached-cartography-station-resolver.js'
import { GalaxyBookmarkService } from './application/galaxy-bookmark-service.js'
import { SavedGalaxyQueryService } from './application/saved-galaxy-query-service.js'
import { DashboardMarketSignalService } from './application/dashboard-market-signal-service.js'
import { MarketSignalService } from './application/market-signal-service.js'
import { DefaultExplorationBodyQuery } from './application/default-exploration-body-query.js'
import { DefaultExplorationTargetQuery } from './application/default-exploration-target-query.js'
import type { CopilotText } from './application/copilot-text-service.js'
import type { CopilotRealtime } from './application/copilot-realtime-service.js'
import type { ExternalCartographySource } from './domain/cartography.js'
import type { ExplorationTargetSearchSource } from './domain/exploration-target.js'
import type { FactionPresenceSearchSource, OutfittingSearchSource, ShipyardSearchSource, StationLookupSource, StationSearchSource, StationStockSource, SystemSearchSource } from './domain/station-market.js'
import type { GalnetSource } from './domain/galnet.js'
import type { OpenAiSecretRepository, SystemSettingsRepository } from './domain/system-configuration.js'
import type { MacroRepository } from './domain/macros.js'
import type { CommandCatalogueChange } from './domain/commands.js'
import { InMemoryRuntimeStateStore } from './infrastructure/in-memory-runtime-state-store.js'
import { InMemoryNavigationRouteStore } from './infrastructure/in-memory-navigation-route-store.js'
import { InMemoryControlDeckConfigurationRepository } from './infrastructure/in-memory-control-deck-configuration-repository.js'
import { InMemorySystemSettingsRepository } from './infrastructure/json-system-configuration.js'
import { InMemoryOpenAiSecretRepository } from './infrastructure/json-openai-secret-repository.js'
import { InMemoryMacroRepository } from './infrastructure/macro-repositories.js'
import {
  NotifyingControlDeckConfigurationRepository,
  NotifyingMacroRepository,
  NotifyingSystemSettingsRepository
} from './infrastructure/notifying-command-source-repositories.js'
import { MacroService } from './application/macro-service.js'
import { InProcessPublisher } from './infrastructure/in-process-publisher.js'
import { PhoenixHttpServer } from './infrastructure/phoenix-http-server.js'
import { SqliteDatabase } from './infrastructure/sqlite-database.js'
import { EdsmCartographySource } from './infrastructure/edsm-cartography-source.js'
import { createConfiguredCopilot } from './infrastructure/configured-copilot.js'
import { PhoenixMcpServer } from './infrastructure/phoenix-mcp-server.js'
import { ArdentStationSearchSource } from './infrastructure/ardent-station-search-source.js'
import { EdsmStationStockSource } from './infrastructure/edsm-station-stock-source.js'
import { SpanshShipyardSearchSource } from './infrastructure/spansh-shipyard-search-source.js'
import { SpanshOutfittingSearchSource } from './infrastructure/spansh-outfitting-search-source.js'
import { SpanshStationLookupSource } from './infrastructure/spansh-station-lookup-source.js'
import { SpanshSearchClient } from './infrastructure/spansh-search-client.js'
import { SpanshSystemSearchSource } from './infrastructure/spansh-system-search-source.js'
import { SpanshFactionPresenceSource } from './infrastructure/spansh-faction-presence-source.js'
import { SpanshExplorationTargetSource } from './infrastructure/spansh-exploration-target-source.js'
import { CatalogueSnapshotLoader } from './infrastructure/catalogue-snapshot-loader.js'
import { ApplicationPaths } from './infrastructure/application-paths.js'
import { FrontierGalnetSource } from './infrastructure/frontier-galnet-source.js'
import type { PairingAccessController } from './infrastructure/pairing-access-controller.js'
import { OpenAiConfigurationService } from './application/openai-configuration-service.js'
import { OpenAiWebSearchSource } from './infrastructure/openai-web-search-source.js'
import { ControlDeckEliteDestinationInput } from './infrastructure/control-deck-elite-destination-input.js'
import type { WebSearchSource } from './domain/web-search.js'

export interface PhoenixApplicationOptions {
  applicationPaths?: ApplicationPaths
  eliteBindings?: EliteDangerousBindingSource
  accessControl?: PairingAccessController
  cartographySource?: ExternalCartographySource
  controlDeckConfigurationRepository?: ControlDeckConfigurationRepository<PhoenixControlDeckConfiguration>
  copilot?: CopilotText | null
  copilotRealtime?: CopilotRealtime | null
  copilotProfiles?: CopilotProfiles | null
  commodityCataloguePath?: string
  databasePath?: string
  eliteDirectory?: string | null
  engineeringCatalogueDirectory?: string
  eliteBindingsDirectory?: string | null
  host?: string
  galnetSource?: GalnetSource
  keyboardOutput?: KeyboardOutput
  keyboardOutputId?: string
  moduleCataloguePath?: string
  openAiSecretRepository?: OpenAiSecretRepository
  openAiEnvironmentKey?: string | null
  macroRepository?: MacroRepository
  port?: number
  personalEquipmentCataloguePath?: string
  shipCataloguePath?: string
  stationSearchSource?: StationSearchSource
  shipyardSearchSource?: ShipyardSearchSource
  outfittingSearchSource?: OutfittingSearchSource
  stationLookupSource?: StationLookupSource
  systemSearchSource?: SystemSearchSource
  factionPresenceSource?: FactionPresenceSearchSource
  explorationTargetSource?: ExplorationTargetSearchSource
  stationStockSource?: StationStockSource
  systemSettingsRepository?: SystemSettingsRepository
  webPort?: number
  webRoot?: string
  webSearchSource?: WebSearchSource
}

export class PhoenixApplication {
  private readonly controlDeck: ControlDeckIntegration
  private readonly eliteControls: ControlDeckCommandService
  private readonly database: SqliteDatabase
  private readonly eventIngestion: GameEventIngestionService
  private readonly journalSource: EliteJournalFileSource
  private readonly journalBackfill: EliteJournalHistoryBackfill
  private readonly inventorySource: EliteInventoryFileSource
  private readonly navigationRouteSource: EliteNavigationRouteFileSource
  private readonly gameActions: GameActions
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
    const cartographyUpdates = new InProcessPublisher<CartographyUpdate>()
    const displayCommandUpdates = new InProcessPublisher<DisplayCommand>()
    const commandCatalogueChanges = new InProcessPublisher<CommandCatalogueChange>()
    const communicationUpdates = new InProcessPublisher<CommunicationMessage>()
    const engineeringProjectUpdates = new InProcessPublisher<EngineeringProjectsChanged>()
    this.stateStore = new InMemoryRuntimeStateStore()
    this.database = new SqliteDatabase(
      resolveProjectPath(
        projectRoot,
        options.databasePath ?? process.env.PHOENIX_DATABASE_PATH ?? resolve(paths.user.data, 'runtime/phoenix.sqlite')
      )
    )
    const activityLog = new ActivityLogService(this.database)
    const missions = new MissionDataService(this.database)
    const communications = new CommunicationDataService(this.database, communicationUpdates)
    const localTraffic = new LocalTrafficService(this.database)
    const bookmarks = new GalaxyBookmarkService(this.database)
    const savedGalaxyQueries = new SavedGalaxyQueryService(this.database.savedGalaxyQueries)
    const runtimeCatalogueDirectory = resolve(paths.user.data, 'runtime/catalogue')
    const engineeringCatalogueDirectory = resolveProjectPath(projectRoot,
      options.engineeringCatalogueDirectory ?? process.env.PHOENIX_ENGINEERING_CATALOGUE_PATH ?? resolve(runtimeCatalogueDirectory, 'engineering'))
    const catalogues = new CatalogueSnapshotLoader().load({
      commodities: resolveProjectPath(projectRoot,
        options.commodityCataloguePath ?? process.env.PHOENIX_COMMODITY_CATALOGUE_PATH ?? resolve(runtimeCatalogueDirectory, 'commodities.json')),
      engineeringDirectory: engineeringCatalogueDirectory,
      personalEquipment: resolveProjectPath(projectRoot,
        options.personalEquipmentCataloguePath ?? process.env.PHOENIX_PERSONAL_EQUIPMENT_CATALOGUE_PATH ?? resolve(runtimeCatalogueDirectory, 'personal-equipment.json')),
      ships: resolveProjectPath(projectRoot,
        options.shipCataloguePath ?? process.env.PHOENIX_SHIP_CATALOGUE_PATH ?? resolve(runtimeCatalogueDirectory, 'ships.json')),
      modules: resolveProjectPath(projectRoot,
        options.moduleCataloguePath ?? process.env.PHOENIX_MODULE_CATALOGUE_PATH ?? resolve(runtimeCatalogueDirectory, 'modules.json'))
    })
    const gameCatalogue = catalogues.game
    const engineeringCatalogue = catalogues.engineering
    const personalEquipmentUpgrades = new PersonalEquipmentUpgradesService(catalogues.personalEquipment)
    const personalEquipmentSpecialists = new PersonalEquipmentSpecialistsService(
      catalogues.personalEquipment,
      engineeringCatalogue,
      this.stateStore
    )
    const fleet = new FleetDataService(
      this.database,
      {
        resolveBlueprintDisplayName: symbol => engineeringCatalogue.getBlueprint(symbol)?.displayName ?? null,
        resolveModule: identifier => gameCatalogue.resolveModule(identifier),
        resolveShipDisplayName: identifier => gameCatalogue.resolveShip(identifier)?.displayName ?? null
      },
      new CachedCartographyStationResolver(this.database)
    )
    const commanderLog = new CommanderLogService(
      this.database.commanderLog,
      new DefaultCommanderLogProjector(
        missions,
        identifier => gameCatalogue.resolveShip(identifier)?.displayName ?? null,
        identifier => engineeringCatalogue.getBlueprint(identifier)?.displayName ?? null
      )
    )
    const commanderEquipment = new CommanderEquipmentService(
      this.database.commanderEquipment,
      new DefaultCommanderEquipmentCatalogue()
    )
    const personalMaterials = new PersonalMaterialInventoryService(this.stateStore)
    const personalEquipmentPlanner = new PersonalEquipmentPlannerService(
      catalogues.personalEquipment,
      commanderEquipment,
      personalMaterials
    )
    const personalEquipmentReport = new PersonalEquipmentReportService(
      commanderEquipment,
      personalMaterials,
      personalEquipmentUpgrades,
      personalEquipmentSpecialists,
      personalEquipmentPlanner
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
    const cartographyObservationIngestion = new CartographyObservationIngestionService(this.database, this.stateStore, cartographyUpdates)
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
      historicalState,
      cartographyUpdates
    )
    const inventoryIngestion = new EliteInventoryIngestionService(this.eventIngestion)
    const liveJournalProjections = new EliteJournalProjectionPipeline([
      event => journalIngestion.ingest(event),
      event => cartographyObservationIngestion.ingest(event),
      event => missions.ingest(event, 'live-journal'),
      event => communications.ingest(event),
      event => fleet.ingest(event),
      event => commanderEquipment.ingest(event),
      event => commanderLog.ingest(event),
      event => activityLog.ingestJournal(event)
    ])
    this.journalSource = new EliteJournalFileSource(
      configuredEliteDirectory,
      event => liveJournalProjections.project(event)
    )
    this.journalBackfill = new EliteJournalHistoryBackfill(
      configuredEliteDirectory,
      event => {
        historicalJournalIngestion.ingest(event)
        historicalCartographyIngestion.ingest(event)
        missions.ingest(event, 'historical-journal')
        communications.ingest(event, 'historical')
        fleet.ingest(event)
        commanderEquipment.ingest(event)
        commanderLog.ingest(event, 'historical')
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
    const eliteBindings = options.eliteBindings ?? new EliteKeyboardBindingResolver(
      locateBindingsDirectory(options, configuredEliteDirectory)
    )
    const keyboardOutput = options.keyboardOutput ?? new RecordingKeyboardOutput()
    const eliteAdapter = new EliteDangerousCommandAdapter({
      bindings: eliteBindings,
      output: keyboardOutput,
      outputId: options.keyboardOutputId ?? 'recording'
    })
    this.eliteControls = new ControlDeckCommandService([eliteAdapter], { createId: randomUUID })
    const actionGateway = new ControlDeckEliteGameActionGateway(eliteAdapter, this.eliteControls)
    const gameActions = new LoggedGameActions(new GameActionService(actionGateway), activityLog)
    this.gameActions = gameActions
    const systemSettings = new NotifyingSystemSettingsRepository(
      options.systemSettingsRepository ?? new InMemorySystemSettingsRepository(),
      commandCatalogueChanges
    )
    const openAiConfiguration = new OpenAiConfigurationService(
      options.openAiSecretRepository ?? new InMemoryOpenAiSecretRepository(),
      options.openAiEnvironmentKey === undefined
        ? process.env.PHOENIX_OPENAI_API_KEY ?? process.env.OPENAI_API_KEY
        : options.openAiEnvironmentKey ?? undefined
    )
    const controlDeckConfigurations = new NotifyingControlDeckConfigurationRepository(
      options.controlDeckConfigurationRepository ?? new InMemoryControlDeckConfigurationRepository(),
      commandCatalogueChanges
    )
    const macroRepository = new NotifyingMacroRepository(
      options.macroRepository ?? new InMemoryMacroRepository(),
      commandCatalogueChanges
    )
    const macros = new MacroService(
      macroRepository,
      gameActions
    )
    const commandRegistry = new DefaultCommandRegistry(
      gameActions,
      PHOENIX_NAVIGATION_DESTINATIONS,
      macroRepository
    )
    const commandCatalogue = new CommandCatalogueService(commandRegistry, commandCatalogueChanges)
    const commands = new DefaultCommandDispatcher(
      commandCatalogue,
      gameActions,
      PHOENIX_NAVIGATION_DESTINATIONS,
      undefined,
      macros
    )
    this.controlDeck = new ControlDeckIntegration({
      integrations: [createPhoenixControlDeckCommandIntegration(
        commands,
        gameActions,
        this.stateStore,
        runtimeStateUpdates
      )],
      configurationRepository: controlDeckConfigurations,
      createId: randomUUID,
      ownerKey: request => options.accessControl?.ownerKey(request) ?? 'development',
      pathPrefix: '/api/control-deck'
    })
    const numpad = new DefaultNumpadCommands(
      new NumpadTreeProjector(commandCatalogue, controlDeckConfigurations),
      commands
    )
    const statefulActions = new StatefulGameActionService(
      gameActions,
      this.stateStore,
      2_500,
      50
    )
    const cartography = new SystemCartographyService(
      options.cartographySource ?? new EdsmCartographySource(),
      this.database,
      this.stateStore
    )
    const navigation = new DefaultNavigationQuery(navigationRoutes, cartography, this.stateStore)
    const systems = new DefaultSystemDetailsQuery(cartography, this.stateStore)
    const spansh = new SpanshSearchClient()
    const stationSearchSource = options.stationSearchSource ?? new ArdentStationSearchSource({
      resolveCommodity: identifier => gameCatalogue.resolveCommodity(identifier)
    })
    const stationMarkets = new DefaultStationMarketQuery(
      stationSearchSource,
      options.stationStockSource ?? new EdsmStationStockSource(),
      options.shipyardSearchSource ?? new SpanshShipyardSearchSource(spansh),
      options.outfittingSearchSource ?? new SpanshOutfittingSearchSource(spansh),
      options.stationLookupSource ?? new SpanshStationLookupSource(spansh),
      options.systemSearchSource ?? new SpanshSystemSearchSource(spansh),
      options.factionPresenceSource ?? new SpanshFactionPresenceSource(spansh),
      cartography,
      this.stateStore,
      this.database
    )
    const marketSignals = new MarketSignalService(stationSearchSource, this.database)
    const dashboardMarketSignals = new DashboardMarketSignalService(savedGalaxyQueries, marketSignals, this.stateStore)
    const galnet = new GalnetNewsService(options.galnetSource ?? new FrontierGalnetSource(), this.database)
    const navigationData = new NavigationDataService(cartography, navigationRoutes, this.stateStore)
    const eliteDestinations = new EliteDestinationService(
      new ControlDeckEliteDestinationInput(eliteBindings, keyboardOutput),
      this.stateStore,
      navigationRoutes
    )
    const display = new DisplayCommandService(displayCommandUpdates, this.stateStore)
    const engineering = new EngineeringDataService(engineeringCatalogue, this.stateStore)
    const engineeringProjects = new EngineeringProjectService(
      this.database.engineeringProjects,
      engineeringCatalogue,
      engineering,
      engineeringProjectUpdates
    )
    const exploration = new DefaultExplorationBodyQuery(this.database, cartography, this.stateStore)
    const explorationData = new ExplorationDataService(this.database, this.database)
    const explorationTargets = new DefaultExplorationTargetQuery(
      options.explorationTargetSource ?? new SpanshExplorationTargetSource(spansh),
      cartography,
      this.stateStore,
      this.database
    )
    let copilotTools: ReturnType<typeof createPhoenixMcpTools> = []
    const copilotCapabilities = new DefaultCopilotCapabilityService(
      () => copilotTools.map(tool => tool.definition),
      commandCatalogue,
      systemSettings
    )
    const copilotCommands = new CopilotCommands(commands, copilotCapabilities)
    copilotTools = createPhoenixMcpTools({
      commands: copilotCommands,
      display,
      equipment: personalEquipmentReport,
      engineers: new DefaultCommanderEngineersQuery(engineering),
      exploration,
      explorationTargets,
      factions: stationMarkets,
      fleet,
      gameCatalogue,
      navigation,
      markets: stationMarkets,
      missions,
      communications,
      runtimeState: this.stateStore,
      statefulActions,
      stations: stationMarkets,
      systems,
      systemSearch: stationMarkets,
      webSearch: options.webSearchSource ?? new OpenAiWebSearchSource({
        apiKey: () => openAiConfiguration.activeApiKey(),
        model: process.env.PHOENIX_OPENAI_WEB_SEARCH_MODEL ?? process.env.PHOENIX_OPENAI_MODEL ?? 'gpt-5.6-terra'
      })
    })
    const toolRegistry = new CopilotToolRegistry(copilotTools, copilotCapabilities)
    const mcpServer = new PhoenixMcpServer(toolRegistry)
    const configuredCopilot = options.copilot === undefined && options.copilotRealtime === undefined
      ? createConfiguredCopilot(paths, {
          ...(openAiConfiguration.activeApiKey() ? { apiKey: openAiConfiguration.activeApiKey() } : {}),
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
      cartographyUpdates,
      commandCatalogue,
      communicationUpdates,
      commanderEquipment,
      commanderLog,
      dashboardMarketSignals,
      controlDeckHttp: this.controlDeck.http,
      copilot,
      copilotProfiles,
      copilotConversationEvents,
      copilotVoiceHost,
      copilotRealtime,
      copilotCapabilities,
      copilotTools: toolRegistry,
      commands,
      gameActions,
      eliteInventoryDiagnostics: this.inventorySource,
      eliteDestinations,
      eliteJournalDiagnostics: new EliteJournalDiagnosticsService(
        this.journalSource,
        this.journalBackfill
      ),
      eliteNavigationRouteDiagnostics: this.navigationRouteSource,
      eliteStatusDiagnostics: this.statusSource,
      healthCheck: new HealthService(this.database),
      host,
      activityLog,
      mcpServer,
      macros,
      missions,
      bookmarks,
      savedGalaxyQueries,
      communications,
      localTraffic,
      port,
      runtimeState: this.stateStore,
      runtimeStateUpdates,
      systemSettings,
      displayCommands: display,
      engineering,
      engineeringProjects,
      explorationData,
      explorationTargets,
      fleet,
      galaxyData: stationMarkets,
      marketSignals,
      personalMaterials,
      personalEquipmentUpgrades,
      personalEquipmentSpecialists,
      personalEquipmentPlanner,
      galnet,
      navigationData,
      navigationRouteUpdates,
      numpad,
      openAiConfiguration,
      webPort: options.webPort ?? optionalPort(process.env.PHOENIX_WEB_PORT),
      webRoot: resolveProjectPath(projectRoot, options.webRoot ?? paths.resources.web)
    })
  }

  public async start (): Promise<{ host: string, port: number }> {
    this.database.initialize()
    try {
      await this.controlDeck.start()
      await this.eliteControls.start()
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
      await this.controlDeck.stop()
      await this.eliteControls.stop()
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
    await this.controlDeck.stop()
    await this.gameActions.stop?.()
    await this.eliteControls.stop()
    this.database.close()
  }

  public ingestGameEvent (candidate: unknown): GameEventEnvelope {
    return this.eventIngestion.ingest(candidate)
  }
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

function optionalPort (value: string | undefined): number | undefined {
  if (value === undefined) return undefined
  const port = Number(value)
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`Invalid PHOENIX_WEB_PORT: ${value}`)
  }
  return port
}
