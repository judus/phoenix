import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { basename, relative, resolve } from 'node:path'

export const digest = contents => createHash('sha256').update(contents).digest('hex')
export const fileDigest = file => digest(readFileSync(file))
export function assertDigest (file, expected) {
  if (fileDigest(file) !== expected) throw new Error(`AppImage resource checksum mismatch: ${file}`)
}

export async function pinnedResource (resource, cache) {
  mkdirSync(cache, { recursive: true })
  const target = resolve(cache, basename(new URL(resource.url).pathname))
  if (!existsSync(target)) {
    const response = await fetch(resource.url, { signal: AbortSignal.timeout(120_000) })
    if (!response.ok) throw new Error(`AppImage resource download failed (${response.status}): ${resource.url}`)
    const bytes = Buffer.from(await response.arrayBuffer())
    if (digest(bytes) !== resource.sha256) throw new Error(`Downloaded AppImage resource checksum mismatch: ${resource.url}`)
    writeFileSync(target, bytes)
  }
  assertDigest(target, resource.sha256)
  return target
}

export function verifyRuntime (contents, tool) {
  if (contents.subarray(tool.runtimeOffset, tool.runtimeOffset + 4).toString('ascii') !== 'hsqs') {
    throw new Error('AppImage SquashFS offset does not match the pinned runtime.')
  }
  const runtime = Buffer.from(contents.subarray(0, tool.runtimeOffset))
  // appimagetool writes a per-image digest into these 16 bytes; all other runtime bytes are pinned.
  runtime.fill(0, tool.runtimeDigestOffset, tool.runtimeDigestOffset + 16)
  if (digest(runtime) !== tool.embeddedRuntimeSha256) throw new Error('Unexpected AppImage runtime.')
}

export function treeChecksums (root, directory = root) {
  return Object.fromEntries(readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))
    .flatMap(entry => {
      const file = resolve(directory, entry.name)
      if (entry.isSymbolicLink()) throw new Error(`Unexpected AppDir symlink: ${file}`)
      return entry.isDirectory() ? Object.entries(treeChecksums(root, file)) : [[relative(root, file), fileDigest(file)]]
    }))
}

export const appRun = `#!/bin/sh
PHOENIX_APPDIR="\${APPDIR:-$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)}"
export PATH="$PHOENIX_APPDIR/usr/bin:$PATH"
export LD_LIBRARY_PATH="$PHOENIX_APPDIR/usr/lib\${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
export CONTROL_DECK_WAYLAND_KEYMAP_READER="$PHOENIX_APPDIR/usr/bin/control-deck-wayland-keymap-reader"
exec "$PHOENIX_APPDIR/usr/lib/phoenix/runtime/node" "$PHOENIX_APPDIR/usr/lib/phoenix/scripts/package/launcher.mjs" "$@"
`
