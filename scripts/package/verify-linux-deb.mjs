import { execFileSync } from 'node:child_process'
import { accessSync, constants, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

if (process.platform !== 'linux') throw new Error('The Linux package must be verified on Linux.')

const projectRoot = fileURLToPath(new URL('../../', import.meta.url))
const packageJson = JSON.parse(readFileSync(resolve(projectRoot, 'package.json'), 'utf8'))
const architecture = process.arch === 'x64' ? 'amd64' : process.arch === 'arm64' ? 'arm64' : process.arch
const packagePath = resolve(projectRoot, 'dist/installer', `phoenix_${packageJson.version}_${architecture}.deb`)
const temporaryRoot = mkdtempSync(join(tmpdir(), 'phoenix-deb-verify-'))
const extractedRoot = resolve(temporaryRoot, 'root')
const payloadRoot = resolve(extractedRoot, 'opt/phoenix')

try {
  if (!existsSync(packagePath)) throw new Error(`Linux package not found: ${packagePath}`)
  execFileSync('dpkg-deb', ['--extract', packagePath, extractedRoot], { stdio: 'inherit' })

  const fields = execFileSync('dpkg-deb', ['--field', packagePath, 'Package', 'Version', 'Architecture'], { encoding: 'utf8' })
  if (!fields.includes('Package: phoenix') || !fields.includes(`Version: ${packageJson.version}`) || !fields.includes(`Architecture: ${architecture}`)) {
    throw new Error(`Unexpected Debian package metadata:\n${fields}`)
  }

  accessSync(resolve(extractedRoot, 'usr/bin/phoenix'), constants.X_OK)
  accessSync(resolve(payloadRoot, 'runtime/node'), constants.X_OK)
  const desktop = readFileSync(resolve(extractedRoot, 'usr/share/applications/phoenix.desktop'), 'utf8')
  if (!desktop.includes('Exec=/usr/bin/phoenix') || !desktop.includes('Terminal=false')) {
    throw new Error('The PHOENIX desktop entry is incomplete.')
  }

  const environment = { ...process.env, PHOENIX_PAYLOAD_ROOT: payloadRoot }
  execFileSync(process.execPath, [resolve(projectRoot, 'scripts/package/verify-payload.mjs')], { env: environment, stdio: 'inherit' })
  execFileSync(process.execPath, [resolve(projectRoot, 'scripts/package/smoke-test-payload.mjs')], { env: environment, stdio: 'inherit' })
  console.log(`PHOENIX Linux test installer verified: ${packagePath}`)
} finally {
  rmSync(temporaryRoot, { force: true, recursive: true })
}
