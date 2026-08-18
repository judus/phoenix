import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import type { ApplicationPaths } from './application-paths.js'

export async function ensureCatalogueSnapshot (paths: ApplicationPaths): Promise<string> {
  const directory = resolve(paths.user.data, 'runtime/catalogue')
  const manifest = resolve(directory, 'manifest.json')

  if (process.env.PHOENIX_CATALOGUE_REFRESH === 'false') {
    if (!existsSync(manifest)) {
      throw new Error(
        'PHOENIX catalogue data is unavailable. Enable catalogue refresh or run npm run catalogue:refresh before starting PHOENIX.'
      )
    }
    return directory
  }

  try {
    await runRefresh(paths, directory)
  } catch (error) {
    if (!existsSync(manifest)) throw error
    console.warn('PHOENIX catalogue refresh failed; using the existing local snapshot.', error)
  }
  if (!existsSync(manifest)) throw new Error('PHOENIX catalogue refresh completed without creating a manifest.')
  return directory
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
      else reject(new Error(`PHOENIX catalogue refresh failed (${signal ?? `exit ${code ?? 'unknown'}`}). First launch requires network access.`))
    })
  })
}
