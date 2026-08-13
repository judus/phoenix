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
import { ApplicationPaths } from './infrastructure/application-paths.js'
import { PairingAccessController } from './infrastructure/pairing-access-controller.js'
import { JsonMacroRepository } from './infrastructure/macro-repositories.js'

let application: PhoenixApplication | null = null

try {
  const projectRoot = fileURLToPath(new URL('../../../', import.meta.url))
  const environmentFile = resolve(projectRoot, '.env')
  if (existsSync(environmentFile)) loadEnvFile(environmentFile)
  const paths = process.env.PHOENIX_PATH_MODE === 'installed'
    ? new ApplicationPaths({ installRoot: projectRoot })
    : ApplicationPaths.development(projectRoot)

  const settingsPath = resolve(paths.user.config, process.env.PHOENIX_SETTINGS_PATH ?? 'settings.json')
  const accessControl = new PairingAccessController(resolve(paths.user.config, 'pairing.json'))
  const runtimeSystemPath = resolve(paths.user.data, process.env.PHOENIX_RUNTIME_SYSTEM_PATH ?? 'runtime/system.json')
  const settingsRepository = new JsonSystemSettingsRepository(settingsPath)
  const settings = settingsRepository.loadOrCreate()
  const controls = bootstrapControlBackend(settings)
  new JsonRuntimeSystemSnapshotWriter(runtimeSystemPath).write(controls.snapshot)

  application = new PhoenixApplication({
    accessControl,
    applicationPaths: paths,
    controlGridLayoutRepository: settingsRepository,
    macroRepository: new JsonMacroRepository(resolve(paths.user.config, 'macros.json')),
    systemSettingsRepository: settingsRepository,
    inputBackend: controls.backend
  })
  const address = await application.start()
  console.log(`PHOENIX server listening on http://${address.host}:${address.port}`)
  console.log(`PHOENIX device pairing code: ${accessControl.pairingCode}`)
  startCatalogueRefresh(paths)
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

function startCatalogueRefresh (paths: ApplicationPaths): void {
  if (process.env.PHOENIX_CATALOGUE_REFRESH === 'false') return
  const worker = spawn(process.execPath, [
    resolve(paths.installRoot, 'scripts/catalogue/refresh.mjs'),
    '--output',
    resolve(paths.user.data, 'runtime/catalogue'),
    '--max-age-hours',
    process.env.PHOENIX_CATALOGUE_REFRESH_HOURS ?? '24'
  ], {
    cwd: paths.installRoot,
    detached: false,
    stdio: 'ignore'
  })
  worker.on('error', error => console.warn('PHOENIX catalogue refresh could not start.', error))
  worker.unref()
}
