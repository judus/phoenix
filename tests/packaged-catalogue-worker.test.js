import { spawnSync } from 'node:child_process'
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, expect, test } from 'vitest'
import { buildCatalogueWorker } from '../scripts/package/build-catalogue-worker.mjs'
import { PERSONAL_EQUIPMENT_SOURCE } from '../scripts/catalogue/build-personal-equipment-catalogue.mjs'

const roots = []
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }) })

test('standalone catalogue worker loads its dependencies outside the checkout and accepts a fresh snapshot', async () => {
  const root = mkdtempSync(join(tmpdir(), 'phoenix catalogue worker-'))
  roots.push(root)
  const worker = join(root, 'refresh.mjs')
  await buildCatalogueWorker(worker)
  const snapshot = join(root, 'snapshot')
  cpSync(resolve('tests/fixtures/catalogue'), snapshot, { recursive: true })
  const manifest = JSON.stringify({ schemaVersion: 6, checkedAt: new Date().toISOString(),
    sources: { personalEquipment: PERSONAL_EQUIPMENT_SOURCE.revision } })
  writeFileSync(join(snapshot, 'manifest.json'), manifest)
  const result = spawnSync(process.execPath, [worker, '--output', snapshot], {
    cwd: root, encoding: 'utf8', timeout: 10_000
  })
  expect(result.stderr).toBe('')
  expect(result.status).toBe(0)
  expect(result.stdout).toContain('Catalogue check skipped;')
  expect(readFileSync(join(snapshot, 'manifest.json'), 'utf8')).toBe(manifest)

  const invalid = spawnSync(process.execPath, [worker, '--not-an-option'], { cwd: root, encoding: 'utf8', timeout: 10_000 })
  expect(invalid.status).toBe(1)
  expect(invalid.stderr).toContain('Unknown catalogue refresh option: --not-an-option')
  expect(invalid.stderr).not.toContain('Dynamic require')
})
