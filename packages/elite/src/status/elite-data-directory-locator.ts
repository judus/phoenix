import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { resolve } from 'node:path'

export interface EliteDataDirectoryLocatorOptions {
  explicitDirectory?: string
  homeDirectory?: string
  platform?: NodeJS.Platform
}

export class EliteDataDirectoryLocator {
  private readonly explicitDirectory?: string
  private readonly homeDirectory: string
  private readonly platform: NodeJS.Platform

  public constructor (options: EliteDataDirectoryLocatorOptions = {}) {
    this.explicitDirectory = options.explicitDirectory
    this.homeDirectory = options.homeDirectory ?? homedir()
    this.platform = options.platform ?? process.platform
  }

  public locate (): string | null {
    if (this.explicitDirectory) return resolve(this.explicitDirectory)

    const suffix = ['Saved Games', 'Frontier Developments', 'Elite Dangerous']
    const candidates = this.platform === 'win32'
      ? [resolve(this.homeDirectory, ...suffix)]
      : [
          resolve(this.homeDirectory, '.steam/debian-installation/steamapps/compatdata/359320/pfx/drive_c/users/steamuser', ...suffix),
          resolve(this.homeDirectory, '.steam/steam/steamapps/compatdata/359320/pfx/drive_c/users/steamuser', ...suffix),
          resolve(this.homeDirectory, '.local/share/Steam/steamapps/compatdata/359320/pfx/drive_c/users/steamuser', ...suffix)
        ]

    return candidates.find(candidate => existsSync(candidate)) ?? null
  }
}
