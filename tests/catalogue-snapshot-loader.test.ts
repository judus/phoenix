import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test, vi } from 'vitest'
import { CatalogueSnapshotLoader } from '../apps/server/src/infrastructure/catalogue-snapshot-loader.js'

const projectRoot = fileURLToPath(new URL('../', import.meta.url))

test('an invalid refreshed catalogue falls back to the bundled snapshot', () => {
  const runtimeDirectory = mkdtempSync(join(tmpdir(), 'phoenix-catalogue-'))
  mkdirSync(join(runtimeDirectory, 'engineering'))
  writeFileSync(join(runtimeDirectory, 'manifest.json'), '{}')
  const warning = vi.spyOn(console, 'warn').mockImplementation(() => {})

  try {
    const snapshot = new CatalogueSnapshotLoader().load(
      paths(runtimeDirectory),
      paths(join(projectRoot, 'data/catalogue'))
    )

    expect(snapshot.game.getDiagnostics().shipCount).toBeGreaterThan(40)
    expect(snapshot.engineering.listMaterials().length).toBeGreaterThan(100)
    expect(warning).toHaveBeenCalledOnce()
  } finally {
    warning.mockRestore()
    rmSync(runtimeDirectory, { recursive: true, force: true })
  }
})

function paths (directory: string) {
  return {
    directory,
    engineeringDirectory: join(directory, 'engineering'),
    ships: join(directory, 'ships.json'),
    modules: join(directory, 'modules.json')
  }
}
