import { isAbsolute, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { DisplayCommand, GameEventEnvelope, RuntimeState } from '@phoenix/contracts'
import { ToolRegistry } from '@maduser/ai-ts'
import {
  EliteDataDirectoryLocator,
  EliteBindingsDirectoryLocator,
  EliteKeyboardBindingResolver,
  EliteInventoryFileSource,
  EliteJournalFileSource,
  EliteNavigationRouteFileSource,
  EliteStatusFileSource,
  JsonEngineeringCatalogue,
  JsonGameCatalogue
} from '@phoenix/elite'
import { CatalogueShipLoadoutEnricher } from './application/catalogue-ship-loadout-enricher.js'
import { CopilotConversationEventService } from './application/copilot-conversation-event-service.js'
import { CatalogueDiagnosticsService } from './application/catalogue-diagnostics-service.js'
import { CachedSystemCartographyService } from './application/cached-system-cartography-service.js'
import { CartographyObservationIngestionService } from './application/cartography-observation-ingestion-service.js'
import { DefaultNavigationQuery } from './application/default-navigation-query.js'
import { DefaultSystemDetailsQuery } from './application/default-system-details-query.js'
import { DefaultGameActionGateway } from './application/default-game-action-gateway.js'
import { DefaultRuntimeStateProjector } from './application/default-runtime-state-projector.js'
import { GameActionService } from './application/game-action-service.js'
import { createPhoenixMcpTools } from './application/phoenix-mcp-tools.js'
import { StatefulGameActionService } from './application/stateful-game-action-service.js'
import { EliteJournalIngestionService } from './application/elite-journal-ingestion-service.js'
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
import { DefaultExplorationBodyQuery } from './application/default-exploration-body-query.js'
import type { CopilotText } from './application/copilot-text-service.js'
import type { CopilotRealtime } from './application/copilot-realtime-service.js'
import type { GameActionBindingResolver, InputBackend } from './domain/game-actions.js'
import type { CartographySource } from './domain/cartography.js'
import type { StationSearchSource, StationStockSource } from './domain/station-market.js'
import type { ControlGridLayoutRepository } from './domain/system-configuration.js'
import { DefaultGameActionCatalog } from './infrastructure/default-game-action-catalog.js'
import { InMemoryRuntimeStateStore } from './infrastructure/in-memory-runtime-state-store.js'
import { InMemoryNavigationRouteStore } from './infrastructure/in-memory-navigation-route-store.js'
import { InMemoryControlGridLayoutRepository } from './infrastructure/in-memory-control-grid-layout-repository.js'
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

export interface PhoenixApplicationOptions {
  actionBindingResolver?: GameActionBindingResolver
  cartographySource?: CartographySource
  controlGridLayoutRepository?: ControlGridLayoutRepository
  copilot?: CopilotText | null
  copilotRealtime?: CopilotRealtime | null
  databasePath?: string
  eliteDirectory?: string | null
  engineeringCatalogueDirectory?: string
  eliteBindingsDirectory?: string | null
  host?: string
  inputBackend?: InputBackend
  inputBackendMode?: 'recording' | 'linux-xdotool'
  moduleCataloguePath?: string
  port?: number
  shipCataloguePath?: string
  stationSearchSource?: StationSearchSource
  stationStockSource?: StationStockSource
  webRoot?: string
}

export class PhoenixApplication {
  private readonly database: SqliteDatabase
  private readonly eventIngestion: GameEventIngestionService
  private readonly journalSource: EliteJournalFileSource
  private readonly inventorySource: EliteInventoryFileSource
  private readonly navigationRouteSource: EliteNavigationRouteFileSource
  private readonly server: PhoenixHttpServer
  private readonly stateStore: InMemoryRuntimeStateStore
  private readonly statusSource: EliteStatusFileSource

  public constructor (options: PhoenixApplicationOptions = {}) {
    const projectRoot = fileURLToPath(new URL('../../../', import.meta.url))
    const host = options.host ?? process.env.PHOENIX_HOST ?? '0.0.0.0'
    const port = options.port ?? Number(process.env.PHOENIX_PORT ?? 3400)
    const gameEvents = new InProcessPublisher<GameEventEnvelope>()
    const copilotConversationEvents = new CopilotConversationEventService()
    const runtimeStateUpdates = new InProcessPublisher<RuntimeState>()
    const displayCommandUpdates = new InProcessPublisher<DisplayCommand>()
    this.stateStore = new InMemoryRuntimeStateStore()
    this.database = new SqliteDatabase(
      resolveProjectPath(
        projectRoot,
        options.databasePath ?? process.env.PHOENIX_DATABASE_PATH ?? 'data/runtime/phoenix.sqlite'
      )
    )
    const activityLog = new ActivityLogService(this.database)
    const gameCatalogue = new JsonGameCatalogue(
      resolveProjectPath(
        projectRoot,
        options.shipCataloguePath ?? process.env.PHOENIX_SHIP_CATALOGUE_PATH ?? 'data/catalogue/ships.json'
      ),
      resolveProjectPath(
        projectRoot,
        options.moduleCataloguePath ?? process.env.PHOENIX_MODULE_CATALOGUE_PATH ?? 'data/catalogue/modules.json'
      )
    )
    const engineeringCatalogueDirectory = resolveProjectPath(
      projectRoot,
      options.engineeringCatalogueDirectory ?? process.env.PHOENIX_ENGINEERING_CATALOGUE_PATH ?? 'data/catalogue/engineering'
    )
    const engineeringCatalogue = new JsonEngineeringCatalogue({
      blueprints: resolve(engineeringCatalogueDirectory, 'blueprints.json'),
      engineers: resolve(engineeringCatalogueDirectory, 'engineers.json'),
      materials: resolve(engineeringCatalogueDirectory, 'materials.json'),
      materialUses: resolve(engineeringCatalogueDirectory, 'material-uses.json')
    })
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
    const inventoryIngestion = new EliteInventoryIngestionService(this.eventIngestion)
    this.journalSource = new EliteJournalFileSource(
      configuredEliteDirectory,
      event => {
        journalIngestion.ingest(event)
        cartographyObservationIngestion.ingest(event)
        activityLog.ingestJournal(event)
      }
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
    this.navigationRouteSource = new EliteNavigationRouteFileSource(
      configuredEliteDirectory,
      route => navigationRoutes.replace(route)
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
      cartography,
      this.stateStore,
      this.database
    )
    const navigationData = new NavigationDataService(cartography, navigationRoutes, this.stateStore)
    const display = new DisplayCommandService(displayCommandUpdates, this.stateStore)
    const engineering = new EngineeringDataService(engineeringCatalogue, this.stateStore)
    const exploration = new DefaultExplorationBodyQuery(this.database, cartography, this.stateStore)
    const explorationData = new ExplorationDataService(this.database, this.database)
    const toolRegistry = new ToolRegistry(createPhoenixMcpTools({
      display,
      engineers: new DefaultCommanderEngineersQuery(engineering),
      exploration,
      gameActions,
      gameCatalogue,
      navigation,
      markets: stationMarkets,
      runtimeState: this.stateStore,
      statefulActions,
      stations: stationMarkets,
      systems
    }))
    const mcpServer = new PhoenixMcpServer(toolRegistry)
    const configuredCopilot = options.copilot === undefined && options.copilotRealtime === undefined
      ? createConfiguredCopilot(projectRoot, {
          ...(port > 0 ? { mcpUrl: `http://127.0.0.1:${port}/mcp` } : {}),
          runtimeState: this.stateStore,
          tools: toolRegistry
        })
      : undefined
    const copilot = options.copilot === undefined
      ? configuredCopilot?.text
      : options.copilot ?? undefined
    const copilotRealtime = options.copilotRealtime === undefined
      ? configuredCopilot?.realtime
      : options.copilotRealtime ?? undefined
    this.server = new PhoenixHttpServer({
      catalogueDiagnostics: new CatalogueDiagnosticsService(gameCatalogue, this.stateStore),
      controlGridLayouts: options.controlGridLayoutRepository ?? new InMemoryControlGridLayoutRepository(),
      copilot,
      copilotConversationEvents,
      copilotRealtime,
      gameActions,
      eliteJournalDiagnostics: this.journalSource,
      eliteStatusDiagnostics: this.statusSource,
      healthCheck: new HealthService(this.database),
      host,
      activityLog,
      mcpServer,
      port,
      runtimeState: this.stateStore,
      runtimeStateUpdates,
      displayCommands: display,
      engineering,
      explorationData,
      navigationData,
      webRoot: resolveProjectPath(
        projectRoot,
        options.webRoot ?? process.env.PHOENIX_WEB_ROOT ?? 'apps/web/dist'
      )
    })
  }

  public async start (): Promise<{ host: string, port: number }> {
    this.database.initialize()
    try {
      await this.journalSource.start()
      await this.statusSource.start()
      await this.inventorySource.start()
      await this.navigationRouteSource.start()
      return await this.server.start()
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
