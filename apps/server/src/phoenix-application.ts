import { isAbsolute, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { HealthService } from './application/health-service.js'
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
  private readonly server: PhoenixHttpServer

  public constructor (options: PhoenixApplicationOptions = {}) {
    const projectRoot = fileURLToPath(new URL('../../../', import.meta.url))
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
}

function resolveProjectPath (projectRoot: string, path: string): string {
  if (path === ':memory:' || isAbsolute(path)) return path
  return resolve(projectRoot, path)
}
