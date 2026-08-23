import { execFileSync } from 'node:child_process'
import { accessSync, constants, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

if (process.platform !== 'win32' || process.arch !== 'x64') {
  throw new Error('The PHOENIX Windows installer currently requires x64 Windows.')
}

const projectRoot = fileURLToPath(new URL('../../', import.meta.url))
const packageJson = JSON.parse(readFileSync(resolve(projectRoot, 'package.json'), 'utf8'))
const setup = resolve(projectRoot, 'dist/installer', `PHOENIX-${packageJson.version}-windows-x64-setup.exe`)
const temporaryRoot = mkdtempSync(join(tmpdir(), 'phoenix-windows-installer-'))
const installRoot = resolve(temporaryRoot, 'installation')

try {
  if (!existsSync(setup)) throw new Error(`Windows installer not found: ${setup}`)
  execFileSync(setup, ['/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART', `/DIR=${installRoot}`], { stdio: 'inherit' })

  const launcher = resolve(installRoot, 'Phoenix.exe')
  accessSync(launcher, constants.X_OK)
  accessSync(resolve(installRoot, 'runtime/node.exe'), constants.X_OK)

  const environment = {
    ...process.env,
    PHOENIX_PAYLOAD_ROOT: installRoot,
    PHOENIX_SMOKE_LAUNCHER: launcher
  }
  execFileSync(process.execPath, [resolve(projectRoot, 'scripts/package/verify-payload.mjs')], { env: environment, stdio: 'inherit' })
  execFileSync(process.execPath, [resolve(projectRoot, 'scripts/package/smoke-test-payload.mjs')], { env: environment, stdio: 'inherit' })

  const uninstaller = resolve(installRoot, 'unins000.exe')
  if (!existsSync(uninstaller)) throw new Error('The Windows uninstaller was not installed.')
  execFileSync(uninstaller, ['/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART'], { stdio: 'inherit' })
  console.log(`PHOENIX Windows test installer verified: ${setup}`)
} finally {
  rmSync(temporaryRoot, { force: true, recursive: true })
}
