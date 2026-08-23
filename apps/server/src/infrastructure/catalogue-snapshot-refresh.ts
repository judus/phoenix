import { spawn } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, renameSync, rmSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import type { ApplicationPaths } from './application-paths.js'

export async function ensureCatalogueSnapshot (paths: ApplicationPaths): Promise<string> {
  const directory = resolve(paths.user.data, 'runtime/catalogue')
  const manifest = resolve(directory, 'manifest.json')
  seedBundledSnapshot(paths, directory, manifest)

  if (process.env.PHOENIX_CATALOGUE_REFRESH === 'false') {
    if (!existsSync(manifest)) {
      throw new Error(
        'PHOENIX catalogue data is unavailable. Enable catalogue refresh or run npm run catalogue:refresh before starting PHOENIX.'
      )
    }
    return directory
  }

  if (existsSync(manifest)) {
    void runRefresh(paths, directory).catch(error => {
      console.warn('PHOENIX catalogue refresh failed; using the existing local snapshot.', error)
    })
    return directory
  }

  await runRefresh(paths, directory)
  if (!existsSync(manifest)) throw new Error('PHOENIX catalogue refresh completed without creating a manifest.')
  return directory
}

function seedBundledSnapshot (paths: ApplicationPaths, directory: string, manifest: string): void {
  if (existsSync(manifest)) return
  const bundled = resolve(paths.installRoot, 'resources/catalogue')
  if (!existsSync(resolve(bundled, 'manifest.json'))) return

  const temporary = `${directory}.seed-${process.pid}`
  rmSync(temporary, { recursive: true, force: true })
  mkdirSync(dirname(directory), { recursive: true })
  cpSync(bundled, temporary, { recursive: true })
  rmSync(directory, { recursive: true, force: true })
  renameSync(temporary, directory)
}

async function runRefresh (paths: ApplicationPaths, directory: string): Promise<void> {
  await new Promise<void>((resolveRun, reject) => {
    const worker = spawn(process.execPath, [
      resolve(paths.installRoot, 'scripts/catalogue/refresh.mjs'),
      '--output',
      directory,
      '--max-age-hours',
      process.env.PHOENIX_CATALOGUE_REFRESH_HOURS ?? '24'
    ], {
      cwd: paths.installRoot,
      stdio: 'inherit'
    })
    worker.once('error', reject)
    worker.once('exit', (code, signal) => {
      if (code === 0) resolveRun()
      else reject(new Error(`PHOENIX catalogue refresh failed (${signal ?? `exit ${code ?? 'unknown'}`}).`))
    })
  })
}
