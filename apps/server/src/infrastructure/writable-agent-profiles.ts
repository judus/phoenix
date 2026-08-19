import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync
} from 'node:fs'
import { join } from 'node:path'

const BUNDLED_FILES_UPDATED_ON_START = new Set([
  'agent.md',
  'audio.json',
  'operational.md',
  'prologue.md'
])

export function prepareWritableAgentProfiles (
  resourcesDirectory: string,
  userDirectory: string
): string {
  mkdirSync(userDirectory, { mode: 0o700, recursive: true })
  chmodSync(userDirectory, 0o700)

  for (const profile of readdirSync(resourcesDirectory, { withFileTypes: true })) {
    if (!profile.isDirectory()) continue
    const resourceProfile = join(resourcesDirectory, profile.name)
    const userProfile = join(userDirectory, profile.name)
    mkdirSync(userProfile, { mode: 0o700, recursive: true })
    chmodSync(userProfile, 0o700)

    for (const file of readdirSync(resourceProfile, { withFileTypes: true })) {
      if (!file.isFile()) continue
      const destination = join(userProfile, file.name)
      if (BUNDLED_FILES_UPDATED_ON_START.has(file.name) || !existsSync(destination)) {
        copyFileSync(join(resourceProfile, file.name), destination)
      }
      chmodSync(destination, 0o600)
    }
  }
  return userDirectory
}
