import { existsSync, readFileSync, unwatchFile, watchFile } from 'node:fs'
import { join } from 'node:path'
import type { NavigationRoute } from '@phoenix/contracts'
import { parseEliteNavigationRoute } from './elite-navigation-route-parser.js'

export type EliteNavigationRouteListener = (route: NavigationRoute) => void | Promise<void>

export interface EliteNavigationRouteFileSourceOptions {
  pollInterval?: number
  retryCount?: number
  retryDelay?: number
}

export class EliteNavigationRouteFileSource {
  private readonly filePath: string | null
  private readonly pollInterval: number
  private readonly retryCount: number
  private readonly retryDelay: number
  private lastContents: string | null = null
  private refreshQueue: Promise<boolean> = Promise.resolve(false)
  private readonly handleFileChange = (): void => { void this.refresh() }
  private watching = false

  public constructor (
    directory: string | null,
    private readonly listener: EliteNavigationRouteListener,
    options: EliteNavigationRouteFileSourceOptions = {}
  ) {
    this.filePath = directory ? join(directory, 'NavRoute.json') : null
    this.pollInterval = options.pollInterval ?? 500
    this.retryCount = options.retryCount ?? 5
    this.retryDelay = options.retryDelay ?? 25
  }

  public async start (): Promise<void> {
    if (!this.filePath || this.watching) return
    this.watching = true
    watchFile(this.filePath, { interval: this.pollInterval }, this.handleFileChange)
    await this.refresh()
  }

  public stop (): void {
    if (this.filePath) unwatchFile(this.filePath, this.handleFileChange)
    this.watching = false
  }

  public refresh (): Promise<boolean> {
    const refresh = this.refreshQueue.then(() => this.readCurrent())
    this.refreshQueue = refresh.catch(() => false)
    return refresh
  }

  private async readCurrent (): Promise<boolean> {
    if (!this.filePath || !existsSync(this.filePath)) return false
    for (let attempt = 0; attempt < this.retryCount; attempt++) {
      try {
        const contents = readFileSync(this.filePath, 'utf8')
        if (contents === this.lastContents) return false
        await this.listener(parseEliteNavigationRoute(JSON.parse(contents)))
        this.lastContents = contents
        return true
      } catch {
        if (attempt + 1 < this.retryCount) await delay(this.retryDelay)
      }
    }
    return false
  }
}

function delay (milliseconds: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, milliseconds))
}
