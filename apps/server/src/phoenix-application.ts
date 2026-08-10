import { isAbsolute, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { GameEventEnvelope, RuntimeState } from '@phoenix/contracts'
import {
  EliteDataDirectoryLocator,
  EliteJournalFileSource,
  EliteStatusFileSource,
  JsonGameCatalogue
} from '@phoenix/elite'
import { CatalogueShipLoadoutEnricher } from './application/catalogue-ship-loadout-enricher.js'
import { CatalogueDiagnosticsService } from './application/catalogue-diagnostics-service.js'
import { DefaultGameActionGateway } from './application/default-game-action-gateway.js'
import { DefaultRuntimeStateProjector } from './application/default-runtime-state-projector.js'
import { DeveloperActionService } from './application/developer-action-service.js'
import { EliteJournalIngestionService } from './application/elite-journal-ingestion-service.js'
import { EliteStatusIngestionService } from './application/elite-status-ingestion-service.js'
import { GameEventIngestionService } from './application/game-event-ingestion-service.js'
import { HealthService } from './application/health-service.js'
import type { GameActionBindingResolver, InputBackend } from './domain/game-actions.js'
import { DefaultGameActionCatalog } from './infrastructure/default-game-action-catalog.js'
import { InMemoryRuntimeStateStore } from './infrastructure/in-memory-runtime-state-store.js'
import { InProcessPublisher } from './infrastructure/in-process-publisher.js'
import { PhoenixHttpServer } from './infrastructure/phoenix-http-server.js'
import { RecordingInputBackend } from './infrastructure/recording-input-backend.js'
import { SqliteDatabase } from './infrastructure/sqlite-database.js'
import { StaticGameActionBindingResolver } from './infrastructure/static-game-action-binding-resolver.js'

export interface PhoenixApplicationOptions {
  actionBindingResolver?: GameActionBindingResolver
  databasePath?: string
  eliteDirectory?: string | null
  host?: string
  inputBackend?: InputBackend
  moduleCataloguePath?: string
  port?: number
  shipCataloguePath?: string
  webRoot?: string
}

export class PhoenixApplication {
  private readonly database: SqliteDatabase
  private readonly eventIngestion: GameEventIngestionService
  private readonly journalSource: EliteJournalFileSource
  private readonly server: PhoenixHttpServer
  private readonly stateStore: InMemoryRuntimeStateStore
  private readonly statusSource: EliteStatusFileSource

  public constructor (options: PhoenixApplicationOptions = {}) {
    const projectRoot = fileURLToPath(new URL('../../../', import.meta.url))
    const gameEvents = new InProcessPublisher<GameEventEnvelope>()
    const runtimeStateUpdates = new InProcessPublisher<RuntimeState>()
    this.stateStore = new InMemoryRuntimeStateStore()
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
    const projector = new DefaultRuntimeStateProjector(
      this.stateStore,
      runtimeStateUpdates,
      new CatalogueShipLoadoutEnricher(gameCatalogue)
    )
    gameEvents.subscribe(event => projector.project(event))
    this.eventIngestion = new GameEventIngestionService(gameEvents)
    const configuredEliteDirectory = options.eliteDirectory === null
      ? null
      : new EliteDataDirectoryLocator({
          explicitDirectory: options.eliteDirectory ?? process.env.PHOENIX_ELITE_DIRECTORY
        }).locate()
    const statusIngestion = new EliteStatusIngestionService(this.eventIngestion)
    const journalIngestion = new EliteJournalIngestionService(this.eventIngestion)
    this.journalSource = new EliteJournalFileSource(
      configuredEliteDirectory,
      event => {
        journalIngestion.ingest(event)
      }
    )
    this.statusSource = new EliteStatusFileSource(
      configuredEliteDirectory,
      status => {
        statusIngestion.ingest(status)
      }
    )
    const actionGateway = new DefaultGameActionGateway(
      new DefaultGameActionCatalog(),
      options.actionBindingResolver ?? new StaticGameActionBindingResolver(),
      options.inputBackend ?? new RecordingInputBackend()
    )
    this.database = new SqliteDatabase(
      resolveProjectPath(
        projectRoot,
        options.databasePath ?? process.env.PHOENIX_DATABASE_PATH ?? 'data/runtime/phoenix.sqlite'
      )
    )
    this.server = new PhoenixHttpServer({
      catalogueDiagnostics: new CatalogueDiagnosticsService(gameCatalogue, this.stateStore),
      developerActions: new DeveloperActionService(actionGateway),
      eliteJournalDiagnostics: this.journalSource,
      eliteStatusDiagnostics: this.statusSource,
      healthCheck: new HealthService(this.database),
      host: options.host ?? process.env.PHOENIX_HOST ?? '0.0.0.0',
      port: options.port ?? Number(process.env.PHOENIX_PORT ?? 3400),
      runtimeState: this.stateStore,
      runtimeStateUpdates,
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
      return await this.server.start()
    } catch (cause) {
      this.journalSource.stop()
      this.statusSource.stop()
      this.database.close()
      throw cause
    }
  }

  public async stop (): Promise<void> {
    this.journalSource.stop()
    this.statusSource.stop()
    await this.server.stop()
    this.database.close()
  }

  public ingestGameEvent (candidate: unknown): GameEventEnvelope {
    return this.eventIngestion.ingest(candidate)
  }
}

function resolveProjectPath (projectRoot: string, path: string): string {
  if (path === ':memory:' || isAbsolute(path)) return path
  return resolve(projectRoot, path)
}
