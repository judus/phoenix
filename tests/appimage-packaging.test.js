import { execFileSync } from 'node:child_process'
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { afterEach, expect, test, vi } from 'vitest'
import { appRun, assertDigest, digest, pinnedResource, treeChecksums, verifyRuntime } from '../scripts/package/appimage-support.mjs'

const roots = []
const temporary = () => { const path = mkdtempSync(resolve(tmpdir(), 'phoenix appimage test-')); roots.push(path); return path }
afterEach(() => { vi.unstubAllGlobals(); for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }) })

test('pins all runtime bytes except the AppImage-specific digest', () => {
  const runtime = Buffer.alloc(128, 0)
  const tool = { runtimeOffset: 128, runtimeDigestOffset: 32, embeddedRuntimeSha256: digest(runtime) }
  const contents = Buffer.concat([runtime, Buffer.from('hsqs filesystem')])
  contents.fill(1, 32, 48)
  expect(() => verifyRuntime(contents, tool)).not.toThrow()
  contents[49] = 1
  expect(() => verifyRuntime(contents, tool)).toThrow('Unexpected AppImage runtime')
  contents[128] = 0
  expect(() => verifyRuntime(contents, tool)).toThrow('SquashFS offset')
})

test('downloads only checksum-matching resources and revalidates the cache', async () => {
  const cache = temporary()
  const resource = { url: 'https://example.invalid/tool.AppImage', sha256: digest('trusted') }
  const fetch = vi.fn().mockResolvedValue(new Response('wrong'))
  vi.stubGlobal('fetch', fetch)
  await expect(pinnedResource(resource, cache)).rejects.toThrow('checksum mismatch')
  fetch.mockResolvedValue(new Response('trusted'))
  const path = await pinnedResource(resource, cache)
  expect(readFileSync(path, 'utf8')).toBe('trusted')
  await pinnedResource(resource, cache)
  expect(fetch).toHaveBeenCalledTimes(2)
  writeFileSync(path, 'tampered')
  await expect(pinnedResource(resource, cache)).rejects.toThrow('checksum mismatch')
})

test('tracks file contents and rejects a mismatched digest', () => {
  const root = temporary()
  writeFileSync(resolve(root, 'file'), 'one')
  expect(treeChecksums(root)).toEqual({ file: digest('one') })
  expect(() => assertDigest(resolve(root, 'file'), digest('two'))).toThrow('checksum mismatch')
})

test.skipIf(process.platform !== 'linux')('rejects AppDir symlinks', () => {
  const root = temporary()
  symlinkSync('/etc/passwd', resolve(root, 'unexpected'))
  expect(() => treeChecksums(root)).toThrow('Unexpected AppDir symlink')
})

test.skipIf(process.platform !== 'linux')('relocatable entrypoint uses bundled runtime/helper and preserves arguments', () => {
  const root = temporary()
  const runtime = resolve(root, 'usr/lib/phoenix/runtime')
  mkdirSync(runtime, { recursive: true })
  const probe = resolve(root, 'probe.mjs')
  writeFileSync(probe, 'console.log(JSON.stringify({args:process.argv.slice(2),path:process.env.PATH,lib:process.env.LD_LIBRARY_PATH,helper:process.env.CONTROL_DECK_WAYLAND_KEYMAP_READER}))')
  writeFileSync(resolve(runtime, 'node'), `#!/bin/sh\nexec "${process.execPath}" "${probe}" "$@"\n`)
  chmodSync(resolve(runtime, 'node'), 0o755)
  const launcher = resolve(root, 'AppRun')
  writeFileSync(launcher, appRun)
  for (const appdir of [undefined, root]) {
    const env = { ...process.env, LD_LIBRARY_PATH: '/existing' }
    delete env.APPDIR
    if (appdir) env.APPDIR = appdir
    const result = JSON.parse(execFileSync('/bin/sh', [launcher, '--stop', 'space argument'], { env, encoding: 'utf8' }))
    expect(result.args).toEqual([resolve(root, 'usr/lib/phoenix/scripts/package/launcher.mjs'), '--stop', 'space argument'])
    expect(result.path.startsWith(`${root}/usr/bin:`)).toBe(true)
    expect(result.lib).toBe(`${root}/usr/lib:/existing`)
    expect(result.helper).toBe(`${root}/usr/bin/control-deck-wayland-keymap-reader`)
  }
})
