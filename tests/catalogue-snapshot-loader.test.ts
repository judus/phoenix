import { join } from 'node:path'
import { cpSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { expect, test } from 'vitest'
import { CatalogueSnapshotLoader } from '../apps/server/src/infrastructure/catalogue-snapshot-loader.js'

const projectRoot = fileURLToPath(new URL('../', import.meta.url))

test('loads a complete synthetic catalogue snapshot', () => {
  const snapshot = new CatalogueSnapshotLoader().load(paths(join(projectRoot, 'tests/fixtures/catalogue')))

  expect(snapshot.game.getDiagnostics()).toMatchObject({ shipCount: 3, moduleCount: 6 })
  expect(snapshot.engineering.listMaterials()).toHaveLength(1)
  expect(snapshot.personalEquipment.getSnapshot().equipmentDefinitions).toHaveLength(1)
})

test.each(['missing', 'invalid JSON', 'invalid schema'])('rejects a %s module snapshot instead of substituting bundled data', failure => {
  const directory = mkdtempSync(join(tmpdir(), 'phoenix-catalogue-loader-'))
  try {
    cpSync(join(projectRoot, 'tests/fixtures/catalogue'), directory, { recursive: true })
    const modulePath = join(directory, 'modules.json')
    if (failure === 'missing') rmSync(modulePath)
    else writeFileSync(modulePath, failure === 'invalid JSON' ? '{' : '{}')
    expect(() => new CatalogueSnapshotLoader().load(paths(directory))).toThrow()
  } finally { rmSync(directory, { recursive: true, force: true }) }
})

function paths (directory: string) {
  return {
    commodities: join(directory, 'commodities.json'),
    engineeringDirectory: join(directory, 'engineering'),
    personalEquipment: join(directory, 'personal-equipment.json'),
    ships: join(directory, 'ships.json'),
    modules: join(directory, 'modules.json')
  }
}
