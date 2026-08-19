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
import { ApplicationPaths } from './infrastructure/application-paths.js'
import { PairingAccessController } from './infrastructure/pairing-access-controller.js'
import { JsonMacroRepository } from './infrastructure/macro-repositories.js'
import { JsonOpenAiSecretRepository } from './infrastructure/json-openai-secret-repository.js'
import { ensureCatalogueSnapshot } from './infrastructure/catalogue-snapshot-refresh.js'
import { serverAccessUrls } from './infrastructure/server-access-urls.js'
import { satelliteAccessUrls } from '@phoenix/control-deck/host'

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
  const catalogueDirectory = await ensureCatalogueSnapshot(paths)

  application = new PhoenixApplication({
    accessControl,
    applicationPaths: paths,
    controlGridLayoutRepository: settingsRepository,
    controlDeckGateway: process.env.PHOENIX_CONTROL_DECK_ENABLED === 'true'
      ? {
          host: process.env.PHOENIX_CONTROL_DECK_HOST ?? '0.0.0.0',
          port: Number(process.env.PHOENIX_CONTROL_DECK_PORT ?? 3402)
        }
      : false,
    macroRepository: new JsonMacroRepository(resolve(paths.user.config, 'macros.json')),
    openAiSecretRepository: new JsonOpenAiSecretRepository(resolve(paths.user.config, 'secrets.json')),
    systemSettingsRepository: settingsRepository,
    inputBackend: controls.backend,
    engineeringCatalogueDirectory: resolve(catalogueDirectory, 'engineering'),
    moduleCataloguePath: resolve(catalogueDirectory, 'modules.json'),
    shipCataloguePath: resolve(catalogueDirectory, 'ships.json')
  })
  const address = await application.start()
  const accessUrls = serverAccessUrls(address)
  console.log(`PHOENIX server listening on ${address.host}:${address.port}`)
  console.log(`PHOENIX local URL: ${accessUrls.local}`)
  console.log(`PHOENIX device pairing code: ${accessControl.pairingCode}`)
  const gateway = application.getControlDeckGatewayAddress()
  if (gateway) {
    console.log(`Control Deck satellite gateway listening on ${gateway.host}:${gateway.port}`)
    for (const url of satelliteAccessUrls(gateway)) console.log(`Control Deck satellite URL: ${url}`)
  }
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
