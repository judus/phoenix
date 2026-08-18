import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, test, vi } from 'vitest'
import { ApplicationPaths } from '../apps/server/src/infrastructure/application-paths.js'
import { ensureCatalogueSnapshot } from '../apps/server/src/infrastructure/catalogue-snapshot-refresh.js'

afterEach(() => vi.unstubAllEnvs())

test('accepts an existing runtime snapshot when automatic refresh is disabled', async () => {
  const root = mkdtempSync(join(tmpdir(), 'phoenix-catalogue-present-'))
  const directory = join(root, 'runtime/catalogue')
  mkdirSync(directory, { recursive: true })
  writeFileSync(join(directory, 'manifest.json'), '{}')
  vi.stubEnv('PHOENIX_CATALOGUE_REFRESH', 'false')

  try {
    await expect(ensureCatalogueSnapshot(paths(root))).resolves.toBe(directory)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('fails clearly when refresh is disabled before the first catalogue fetch', async () => {
  const root = mkdtempSync(join(tmpdir(), 'phoenix-catalogue-missing-'))
  vi.stubEnv('PHOENIX_CATALOGUE_REFRESH', 'false')

  try {
    await expect(ensureCatalogueSnapshot(paths(root))).rejects.toThrow('catalogue data is unavailable')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('retains an existing local snapshot when an online refresh fails', async () => {
  const root = mkdtempSync(join(tmpdir(), 'phoenix-catalogue-stale-'))
  const directory = join(root, 'runtime/catalogue')
  mkdirSync(directory, { recursive: true })
  writeFileSync(join(directory, 'manifest.json'), '{}')
  vi.stubEnv('PHOENIX_CATALOGUE_REFRESH', 'true')
  const warning = vi.spyOn(console, 'warn').mockImplementation(() => {})

  try {
    await expect(ensureCatalogueSnapshot(paths(root))).resolves.toBe(directory)
    expect(warning).toHaveBeenCalledOnce()
  } finally {
    warning.mockRestore()
    rmSync(root, { recursive: true, force: true })
  }
})

function paths (userRoot: string): ApplicationPaths {
  return new ApplicationPaths({ installRoot: '/opt/phoenix-test', userRoot })
}
