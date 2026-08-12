import { existsSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
import { loadEnvFile } from 'node:process'
import { fileURLToPath } from 'node:url'
import { bootstrapControlBackend } from './application/control-backend-bootstrap.js'
import {
  JsonRuntimeSystemSnapshotWriter,
  JsonSystemSettingsRepository
} from './infrastructure/json-system-configuration.js'
import { PhoenixApplication } from './phoenix-application.js'

let application: PhoenixApplication | null = null

try {
  const projectRoot = fileURLToPath(new URL('../../../', import.meta.url))
  const environmentFile = resolve(projectRoot, '.env')
  if (existsSync(environmentFile)) loadEnvFile(environmentFile)

  const settingsPath = resolve(projectRoot, process.env.PHOENIX_SETTINGS_PATH ?? 'data/settings.json')
  const runtimeSystemPath = resolve(
    projectRoot,
    process.env.PHOENIX_RUNTIME_SYSTEM_PATH ?? 'data/runtime/system.json'
  )
  const settingsRepository = new JsonSystemSettingsRepository(settingsPath)
  const settings = settingsRepository.loadOrCreate()
  const controls = bootstrapControlBackend(settings)
  new JsonRuntimeSystemSnapshotWriter(runtimeSystemPath).write(controls.snapshot)

  application = new PhoenixApplication({
    controlGridLayoutRepository: settingsRepository,
    inputBackend: controls.backend
  })
  const address = await application.start()
  console.log(`PHOENIX server listening on http://${address.host}:${address.port}`)
  startCatalogueRefresh(projectRoot)
} catch (error) {
  console.error('ERROR_PHOENIX_START_FAILED', error)
  process.exit(1)
}

async function shutdown (): Promise<void> {
  await application?.stop()
  process.exit(0)
}

process.once('SIGINT', shutdown)
process.once('SIGTERM', shutdown)

function startCatalogueRefresh (projectRoot: string): void {
  if (process.env.PHOENIX_CATALOGUE_REFRESH === 'false') return
  const worker = spawn(process.execPath, [
    resolve(projectRoot, 'scripts/catalogue/refresh.mjs'),
    '--output',
    'data/runtime/catalogue',
    '--max-age-hours',
    process.env.PHOENIX_CATALOGUE_REFRESH_HOURS ?? '24'
  ], {
    cwd: projectRoot,
    detached: false,
    stdio: 'ignore'
  })
  worker.on('error', error => console.warn('PHOENIX catalogue refresh could not start.', error))
  worker.unref()
}
