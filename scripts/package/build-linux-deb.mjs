import { execFileSync } from 'node:child_process'
import { chmodSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

if (process.platform !== 'linux') throw new Error('The Linux package must be built on Linux.')

const projectRoot = fileURLToPath(new URL('../../', import.meta.url))
const packageJson = JSON.parse(readFileSync(resolve(projectRoot, 'package.json'), 'utf8'))
const architecture = debianArchitecture(process.arch)
const payloadRoot = resolve(projectRoot, 'dist/payload', `${process.platform}-${process.arch}`)
const outputRoot = resolve(projectRoot, 'dist/installer')
const workRoot = resolve(outputRoot, `.linux-${process.arch}`)
const packageRoot = resolve(workRoot, 'root')
const installRoot = resolve(packageRoot, 'opt/phoenix')
const output = resolve(outputRoot, `phoenix_${packageJson.version}_${architecture}.deb`)

if (!existsSync(resolve(payloadRoot, 'manifest.json'))) {
  throw new Error('The Linux payload is missing. Run npm run payload:build first.')
}

rmSync(workRoot, { force: true, recursive: true })
mkdirSync(installRoot, { recursive: true })
cpSync(payloadRoot, installRoot, { recursive: true })

write('usr/bin/phoenix', `#!/bin/sh
exec /opt/phoenix/runtime/node /opt/phoenix/scripts/package/launcher.mjs "$@"
`, 0o755)

write('usr/share/applications/phoenix.desktop', `[Desktop Entry]
Type=Application
Name=PHOENIX
Comment=Elite Dangerous companion and control deck
Exec=/usr/bin/phoenix
Icon=phoenix
Terminal=false
Categories=Game;Utility;
Actions=Quit;

[Desktop Action Quit]
Name=Quit PHOENIX
Exec=/usr/bin/phoenix --stop
`, 0o644)

copy(resolve(projectRoot, 'apps/web/public/phoenix.svg'), 'usr/share/icons/hicolor/scalable/apps/phoenix.svg')
copy(resolve(projectRoot, 'LICENSE'), 'usr/share/doc/phoenix/copyright')

write('DEBIAN/control', `Package: phoenix
Version: ${packageJson.version}
Section: games
Priority: optional
Architecture: ${architecture}
Installed-Size: ${installedSize(packageRoot)}
Maintainer: PHOENIX Project
Depends: xdg-utils
Recommends: xdotool
Description: Elite Dangerous companion and control deck
 PHOENIX provides a local web interface, game telemetry, Copilot, macros,
 and configurable controls for Elite Dangerous.
`, 0o644)

mkdirSync(outputRoot, { recursive: true })
execFileSync('dpkg-deb', ['--root-owner-group', '--build', packageRoot, output], { stdio: 'inherit' })
rmSync(workRoot, { force: true, recursive: true })

console.log(`PHOENIX Linux test installer created at ${output}`)

function debianArchitecture (architecture) {
  if (architecture === 'x64') return 'amd64'
  if (architecture === 'arm64') return 'arm64'
  throw new Error(`Unsupported Debian architecture: ${architecture}`)
}

function write (destination, contents, mode) {
  const path = resolve(packageRoot, destination)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, contents, 'utf8')
  chmodSync(path, mode)
}

function copy (source, destination) {
  const path = resolve(packageRoot, destination)
  mkdirSync(dirname(path), { recursive: true })
  cpSync(source, path)
}

function installedSize (root) {
  const bytes = files(root).reduce((total, path) => total + statSync(path).size, 0)
  return Math.ceil(bytes / 1024)
}

function files (directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? files(path) : [path]
  })
}
