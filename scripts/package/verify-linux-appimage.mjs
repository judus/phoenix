import { execFileSync } from 'node:child_process'
import { accessSync, constants, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { assertDigest, treeChecksums, verifyRuntime } from './appimage-support.mjs'

if (process.platform !== 'linux' || process.arch !== 'x64') throw new Error('AppImage verification requires Linux x64.')
const root = fileURLToPath(new URL('../../', import.meta.url))
const version = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')).version
const pins = JSON.parse(readFileSync(resolve(root, 'scripts/package/appimage-resources.json'), 'utf8'))
const image = resolve(root, 'dist/installer', `PHOENIX-${version}-x86_64.AppImage`)
const temporary = mkdtempSync(resolve(tmpdir(), 'phoenix-appimage-verify-'))
try {
  accessSync(image, constants.X_OK)
  verifyRuntime(readFileSync(image), pins.tool)
  execFileSync(image, ['--appimage-extract'], { cwd: temporary, stdio: 'ignore' })
  const appdir = resolve(temporary, 'squashfs-root')
  const payload = resolve(appdir, 'usr/lib/phoenix')
  const manifestText = readFileSync(resolve(appdir, 'appimage-manifest.json'), 'utf8')
  if (manifestText !== readFileSync(`${image}.json`, 'utf8')) throw new Error('AppImage build metadata does not match its embedded manifest.')
  const manifest = JSON.parse(manifestText)
  if (manifest.version !== version || manifest.application !== 'PHOENIX' || manifest.architecture !== 'x64' ||
    JSON.stringify(manifest.resources) !== JSON.stringify(pins)) throw new Error('Unexpected AppImage identity/resources.')
  const actual = treeChecksums(appdir)
  delete actual['appimage-manifest.json']
  if (JSON.stringify(actual) !== JSON.stringify(manifest.files)) throw new Error('AppDir files/checksums do not match.')
  for (const file of ['AppRun', 'usr/bin/xdotool', 'usr/bin/control-deck-wayland-keymap-reader']) accessSync(resolve(appdir, file), constants.X_OK)
  assertDigest(resolve(appdir, 'usr/bin/xdotool'), pins.xdotool.installedSha256)
  assertDigest(resolve(appdir, 'usr/lib/libxdo.so.3'), pins.libxdo.installedSha256)
  assertDigest(resolve(appdir, 'usr/bin/control-deck-wayland-keymap-reader'), manifest.helper.files['bin/control-deck-wayland-keymap-reader'])
  execFileSync(resolve(appdir, 'usr/bin/control-deck-wayland-keymap-reader'), ['--version'], { stdio: 'inherit' })
  execFileSync('desktop-file-validate', [resolve(appdir, 'phoenix.desktop')], { stdio: 'inherit' })
  const environment = { ...process.env, PHOENIX_PAYLOAD_ROOT: payload }
  execFileSync(process.execPath, [resolve(root, 'scripts/package/verify-payload.mjs')], { env: environment, stdio: 'inherit' })
  execFileSync('dbus-run-session', ['--', process.execPath, resolve(root, 'tests/fixtures/linux-tray-session.mjs'),
    resolve(payload, 'scripts/package/linux-tray.mjs')], { stdio: 'inherit', timeout: 15_000 })
  // Exercise the extracted entrypoint first, then the actual executable runtime without FUSE.
  // Both runs isolate writable roots, retain data across restarts and never send game input.
  for (const launcher of [resolve(appdir, 'AppRun'), image]) {
    execFileSync(process.execPath, [resolve(root, 'scripts/package/smoke-test-payload.mjs')], {
      env: { ...environment, PHOENIX_SMOKE_LAUNCHER: launcher, APPIMAGE_EXTRACT_AND_RUN: '1' }, stdio: 'inherit'
    })
  }
  execFileSync('dbus-run-session', ['--', process.execPath,
    resolve(root, 'tests/fixtures/linux-tray-launcher-session.mjs'), image], {
    env: { ...process.env, APPIMAGE_EXTRACT_AND_RUN: '1' }, stdio: 'inherit', timeout: 40_000
  })
  console.log(`PHOENIX AppImage structure and lifecycle verified: ${image}`)
} finally {
  rmSync(temporary, { recursive: true, force: true })
}
