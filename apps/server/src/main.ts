import { existsSync, mkdirSync, renameSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { loadEnvFile } from 'node:process'
import { fileURLToPath } from 'node:url'
import { bootstrapControlOutput } from './application/control-output-bootstrap.js'
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

let application: PhoenixApplication | null = null
let shuttingDown = false
const runtimeStatusPath = process.env.PHOENIX_RUNTIME_STATUS_PATH

removeRuntimeStatus()

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
  const controls = bootstrapControlOutput(settings, {
    waylandRestoreTokenPath: resolve(paths.user.data, 'wayland-keyboard.json')
  })
  new JsonRuntimeSystemSnapshotWriter(runtimeSystemPath).write(controls.snapshot)
  const catalogueDirectory = await ensureCatalogueSnapshot(paths)

  application = new PhoenixApplication({
    accessControl,
    applicationPaths: paths,
    controlDeckConfigurationRepository: settingsRepository,
    macroRepository: new JsonMacroRepository(resolve(paths.user.config, 'macros.json')),
    openAiSecretRepository: new JsonOpenAiSecretRepository(resolve(paths.user.config, 'secrets.json')),
    systemSettingsRepository: settingsRepository,
    keyboardOutput: controls.output,
    keyboardOutputId: controls.id,
    engineeringCatalogueDirectory: resolve(catalogueDirectory, 'engineering'),
    moduleCataloguePath: resolve(catalogueDirectory, 'modules.json'),
    shipCataloguePath: resolve(catalogueDirectory, 'ships.json')
  })
  const address = await application.start()
  const accessUrls = serverAccessUrls(address)
  if (runtimeStatusPath) {
    mkdirSync(dirname(runtimeStatusPath), { recursive: true })
    const temporaryPath = `${runtimeStatusPath}.${process.pid}.tmp`
    writeFileSync(temporaryPath, [
      'PHOENIX READY',
      `Process: ${process.pid}`,
      `This computer: ${accessUrls.local}`,
      ...accessUrls.network.map(url => `Device: ${url}`),
      ...(accessUrls.network.length === 0 ? ['Device: No LAN address detected. Check the Windows network connection.'] : []),
      `Pairing code: ${accessControl.pairingCode}`
    ].join('\r\n'))
    renameSync(temporaryPath, runtimeStatusPath)
  }
  console.log(`PHOENIX server listening on ${address.host}:${address.port}`)
  console.log(`PHOENIX local URL: ${accessUrls.local}`)
  for (const url of accessUrls.network) console.log(`PHOENIX network URL: ${url}`)
  if (accessUrls.network.length > 0) console.log('PHOENIX microphone audio over a network URL requires HTTPS.')
  console.log(`PHOENIX device pairing code: ${accessControl.pairingCode}`)
} catch (error) {
  removeRuntimeStatus()
  console.error('ERROR_PHOENIX_START_FAILED', error)
  process.exit(1)
}

async function shutdown (): Promise<void> {
  if (shuttingDown) return
  shuttingDown = true
  await application?.stop()
  removeRuntimeStatus()
  process.exit(0)
}

function removeRuntimeStatus (): void {
  if (!runtimeStatusPath) return
  try { unlinkSync(runtimeStatusPath) } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
}

process.once('SIGINT', shutdown)
process.once('SIGTERM', shutdown)
if (process.env.PHOENIX_PATH_MODE === 'installed') {
  process.stdin.resume()
  process.stdin.once('end', shutdown)
}
