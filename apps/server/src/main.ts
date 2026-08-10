import { existsSync } from 'node:fs'
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
  const settings = new JsonSystemSettingsRepository(settingsPath).loadOrCreate()
  const controls = bootstrapControlBackend(settings)
  new JsonRuntimeSystemSnapshotWriter(runtimeSystemPath).write(controls.snapshot)

  application = new PhoenixApplication({ inputBackend: controls.backend })
  const address = await application.start()
  console.log(`PHOENIX server listening on http://${address.host}:${address.port}`)
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
