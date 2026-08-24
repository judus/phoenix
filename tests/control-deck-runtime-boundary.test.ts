import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'

describe('embedded Control Deck runtime', () => {
  test('exposes only the runtime modules PHOENIX needs', async () => {
    const manifestPath = fileURLToPath(new URL('../node_modules/control-deck/package.json', import.meta.url))
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as {
      name: string
      private: boolean
      exports: Record<string, unknown>
    }

    expect(manifest.name).toBe('control-deck')
    expect(manifest.private).toBe(true)
    expect(Object.keys(manifest.exports).sort()).toEqual([
      './adapter-keyboard',
      './core',
      './host',
      './integration-elite-dangerous'
    ])
    expect(manifest.exports).not.toHaveProperty('./ui')
    expect(manifest.exports).not.toHaveProperty('./adapter-run-command')
    expect(manifest.exports).not.toHaveProperty('./adapter-sound')
  })
})
