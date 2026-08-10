import { isAbsolute, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { GameEventEnvelope, RuntimeState } from '@phoenix/contracts'
import { DefaultRuntimeStateProjector } from './application/default-runtime-state-projector.js'
import { GameEventIngestionService } from './application/game-event-ingestion-service.js'
import { HealthService } from './application/health-service.js'
import { InMemoryRuntimeStateStore } from './infrastructure/in-memory-runtime-state-store.js'
import { InProcessPublisher } from './infrastructure/in-process-publisher.js'
import { PhoenixHttpServer } from './infrastructure/phoenix-http-server.js'
import { SqliteDatabase } from './infrastructure/sqlite-database.js'

export interface PhoenixApplicationOptions {
  databasePath?: string
  host?: string
  port?: number
  webRoot?: string
}

export class PhoenixApplication {
  private readonly database: SqliteDatabase
  private readonly eventIngestion: GameEventIngestionService
  private readonly server: PhoenixHttpServer
  private readonly stateStore: InMemoryRuntimeStateStore

  public constructor (options: PhoenixApplicationOptions = {}) {
    const projectRoot = fileURLToPath(new URL('../../../', import.meta.url))
    const gameEvents = new InProcessPublisher<GameEventEnvelope>()
    const runtimeStateUpdates = new InProcessPublisher<RuntimeState>()
    this.stateStore = new InMemoryRuntimeStateStore()
    const projector = new DefaultRuntimeStateProjector(this.stateStore, runtimeStateUpdates)
    gameEvents.subscribe(event => projector.project(event))
    this.eventIngestion = new GameEventIngestionService(gameEvents)
    this.database = new SqliteDatabase(
      resolveProjectPath(
        projectRoot,
        options.databasePath ?? process.env.PHOENIX_DATABASE_PATH ?? 'data/runtime/phoenix.sqlite'
      )
    )
    this.server = new PhoenixHttpServer({
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
    return this.server.start()
  }

  public async stop (): Promise<void> {
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
