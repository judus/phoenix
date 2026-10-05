import { execFileSync } from 'node:child_process'
import { chmodSync, copyFileSync, cpSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { appRun, assertDigest, pinnedResource, treeChecksums } from './appimage-support.mjs'

if (process.platform !== 'linux' || process.arch !== 'x64') throw new Error('AppImage builds require Linux x64.')
const root = fileURLToPath(new URL('../../', import.meta.url))
const pins = JSON.parse(readFileSync(resolve(root, 'scripts/package/appimage-resources.json'), 'utf8'))
const { version } = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
const payload = resolve(root, 'dist/payload/linux-x64')
const payloadManifest = JSON.parse(readFileSync(resolve(payload, 'manifest.json'), 'utf8'))
if (payloadManifest.version !== version || payloadManifest.platform !== 'linux' || payloadManifest.architecture !== 'x64') {
  throw new Error('Build the matching Linux x64 payload first.')
}
const output = resolve(root, 'dist/installer', `PHOENIX-${version}-x86_64.AppImage`)
const work = resolve(root, 'dist/installer/.appimage-x64')
const stagedImage = resolve(work, 'PHOENIX.AppImage')
const appdir = resolve(work, 'PHOENIX.AppDir')
const application = resolve(appdir, 'usr/lib/phoenix')
const cache = resolve(root, 'dist/tools/appimage')
rmSync(work, { recursive: true, force: true })
mkdirSync(application, { recursive: true })
mkdirSync(resolve(appdir, 'usr/bin'), { recursive: true })
cpSync(payload, application, { recursive: true, dereference: true })

for (const [name, source, destination] of [
  ['xdotool', 'usr/bin/xdotool', 'usr/bin/xdotool'],
  ['libxdo', 'usr/lib/x86_64-linux-gnu/libxdo.so.3', 'usr/lib/libxdo.so.3']
]) {
  const archive = await pinnedResource(pins[name], cache)
  const extracted = resolve(work, name)
  execFileSync('dpkg-deb', ['--extract', archive, extracted])
  const file = resolve(extracted, source)
  assertDigest(file, pins[name].installedSha256)
  copyFileSync(file, resolve(appdir, destination))
}
chmodSync(resolve(appdir, 'usr/bin/xdotool'), 0o755)

const helperArchive = resolve(root, pins.helper.path)
assertDigest(helperArchive, pins.helper.sha256)
const helperRoot = resolve(work, 'helper')
mkdirSync(helperRoot)
execFileSync('tar', ['-xzf', helperArchive, '-C', helperRoot])
const helper = JSON.parse(readFileSync(resolve(helperRoot, 'package/manifest.json'), 'utf8'))
if (helper.platform !== 'linux' || helper.architecture !== 'x64') throw new Error('Wrong native helper platform.')
for (const [file, sha] of Object.entries(helper.files)) assertDigest(resolve(helperRoot, 'package', file), sha)
const keymapReader = resolve(appdir, 'usr/bin/control-deck-wayland-keymap-reader')
copyFileSync(resolve(helperRoot, 'package/bin/control-deck-wayland-keymap-reader'), keymapReader)
chmodSync(keymapReader, 0o755)
copyFileSync(resolve(helperRoot, 'package/LICENSE'), resolve(application, 'licenses/Control-Deck-Linux-Helper-Licence.txt'))
if (execFileSync(keymapReader, ['--version'], { encoding: 'utf8' }).trim() !== 'control-deck-wayland-keymap-reader 1') {
  throw new Error('Native Wayland helper self-check failed.')
}
writeFileSync(resolve(appdir, 'AppRun'), appRun, { mode: 0o755 })
writeFileSync(resolve(appdir, 'phoenix.desktop'), `[Desktop Entry]
Type=Application
Name=PHOENIX
Comment=Elite Dangerous companion and control deck
Exec=AppRun
Icon=phoenix
Terminal=false
Categories=Game;Utility;
X-AppImage-Version=${version}
Actions=Quit;

[Desktop Action Quit]
Name=Quit PHOENIX
Exec=AppRun --stop
`)
for (const name of ['phoenix.svg', '.DirIcon']) copyFileSync(resolve(payload, 'resources/phoenix.svg'), resolve(appdir, name))
const manifest = { schemaVersion: 1, application: 'PHOENIX', version, platform: 'linux', architecture: 'x64',
  channel: payloadManifest.channel, resources: pins, helper, files: treeChecksums(appdir) }
writeFileSync(resolve(appdir, 'appimage-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)

const tool = await pinnedResource(pins.tool, cache)
chmodSync(tool, 0o755)
const runtime = resolve(work, 'runtime-x86_64')
writeFileSync(runtime, readFileSync(tool).subarray(0, pins.tool.runtimeOffset), { mode: 0o755 })
assertDigest(runtime, pins.tool.runtimeSha256)
execFileSync(tool, ['--runtime-file', runtime, '--no-appstream', appdir, stagedImage], {
  env: { ...process.env, APPIMAGE_EXTRACT_AND_RUN: '1', ARCH: 'x86_64', SOURCE_DATE_EPOCH: '0' }, stdio: 'inherit'
})
chmodSync(stagedImage, 0o755)
// Replace the directory entry, not the inode: an older image may still be mounted.
renameSync(stagedImage, output)
// Include packaging dependencies alongside payload hashes in release metadata.
copyFileSync(resolve(appdir, 'appimage-manifest.json'), `${output}.json`)
rmSync(work, { recursive: true, force: true })
console.log(`PHOENIX AppImage created: ${output}`)
