import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from 'vitest'
import { CatalogueSnapshotLoader } from '../apps/server/src/infrastructure/catalogue-snapshot-loader.js'

const projectRoot = fileURLToPath(new URL('../', import.meta.url))

test('loads one complete catalogue snapshot without an implicit fallback', () => {
  const snapshot = new CatalogueSnapshotLoader().load(paths(join(projectRoot, 'tests/fixtures/catalogue')))

  expect(snapshot.game.getDiagnostics()).toMatchObject({ shipCount: 3, moduleCount: 6 })
  expect(snapshot.engineering.listMaterials()).toHaveLength(1)
})

function paths (directory: string) {
  return {
    engineeringDirectory: join(directory, 'engineering'),
    ships: join(directory, 'ships.json'),
    modules: join(directory, 'modules.json')
  }
}
