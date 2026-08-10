import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, resolve } from 'node:path'

export interface EliteBindingsDirectoryLocatorOptions {
  eliteDataDirectory?: string | null
  explicitDirectory?: string
  homeDirectory?: string
  localAppData?: string
  platform?: NodeJS.Platform
}

export class EliteBindingsDirectoryLocator {
  private readonly options: EliteBindingsDirectoryLocatorOptions

  public constructor (options: EliteBindingsDirectoryLocatorOptions = {}) {
    this.options = options
  }

  public locate (): string | null {
    if (this.options.explicitDirectory) return resolve(this.options.explicitDirectory)

    const candidates: string[] = []
    if (this.options.eliteDataDirectory) {
      const profileDirectory = dirname(dirname(dirname(this.options.eliteDataDirectory)))
      candidates.push(bindingsDirectory(profileDirectory))
    }

    const platform = this.options.platform ?? process.platform
    const home = this.options.homeDirectory ?? homedir()
    if (platform === 'win32') {
      candidates.push(resolve(
        this.options.localAppData ?? resolve(home, 'AppData', 'Local'),
        'Frontier Developments',
        'Elite Dangerous',
        'Options',
        'Bindings'
      ))
    } else {
      for (const profileDirectory of [
        resolve(home, '.steam/debian-installation/steamapps/compatdata/359320/pfx/drive_c/users/steamuser'),
        resolve(home, '.steam/steam/steamapps/compatdata/359320/pfx/drive_c/users/steamuser'),
        resolve(home, '.local/share/Steam/steamapps/compatdata/359320/pfx/drive_c/users/steamuser')
      ]) {
        candidates.push(bindingsDirectory(profileDirectory))
      }
    }

    return candidates.find(candidate => existsSync(candidate)) ?? null
  }
}

function bindingsDirectory (profileDirectory: string): string {
  return resolve(
    profileDirectory,
    'AppData',
    'Local',
    'Frontier Developments',
    'Elite Dangerous',
    'Options',
    'Bindings'
  )
}
