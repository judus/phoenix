import { existsSync, readFileSync, unwatchFile, watchFile } from 'node:fs'
import { join } from 'node:path'
import {
  EliteNavigationRouteSourceDiagnosticsSchema,
  type EliteNavigationRouteSourceDiagnostics,
  type NavigationRoute
} from '@phoenix/contracts'
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
  private retryTimer: NodeJS.Timeout | null = null
  private readonly handleFileChange = (): void => { void this.refresh() }
  private diagnostics: EliteNavigationRouteSourceDiagnostics

  public constructor (
    directory: string | null,
    private readonly listener: EliteNavigationRouteListener,
    options: EliteNavigationRouteFileSourceOptions = {}
  ) {
    this.filePath = directory ? join(directory, 'NavRoute.json') : null
    this.pollInterval = options.pollInterval ?? 500
    this.retryCount = options.retryCount ?? 5
    this.retryDelay = options.retryDelay ?? 25
    this.diagnostics = {
      directory,
      error: directory ? null : 'Elite Dangerous data directory was not found.',
      fileAvailable: this.filePath ? existsSync(this.filePath) : false,
      filePath: this.filePath,
      lastReadAt: null,
      watching: false
    }
  }

  public async start (): Promise<EliteNavigationRouteSourceDiagnostics> {
    if (!this.filePath || this.diagnostics.watching) return this.getDiagnostics()
    this.diagnostics = { ...this.diagnostics, watching: true }
    watchFile(this.filePath, { interval: this.pollInterval }, this.handleFileChange)
    await this.refresh()
    return this.getDiagnostics()
  }

  public stop (): void {
    if (this.filePath) unwatchFile(this.filePath, this.handleFileChange)
    if (this.retryTimer) clearTimeout(this.retryTimer)
    this.retryTimer = null
    this.diagnostics = { ...this.diagnostics, watching: false }
  }

  public refresh (): Promise<boolean> {
    const refresh = this.refreshQueue.then(() => this.readCurrent())
    this.refreshQueue = refresh.catch(() => false)
    return refresh
  }

  public getDiagnostics (): EliteNavigationRouteSourceDiagnostics {
    return EliteNavigationRouteSourceDiagnosticsSchema.parse(structuredClone(this.diagnostics))
  }

  private async readCurrent (): Promise<boolean> {
    if (!this.filePath || !existsSync(this.filePath)) {
      this.diagnostics = { ...this.diagnostics, fileAvailable: false }
      return false
    }
    let lastError: unknown
    for (let attempt = 0; attempt < this.retryCount; attempt++) {
      try {
        const contents = readFileSync(this.filePath, 'utf8')
        if (contents === this.lastContents) {
          this.diagnostics = { ...this.diagnostics, fileAvailable: true }
          return false
        }
        await this.listener(parseEliteNavigationRoute(JSON.parse(contents)))
        this.lastContents = contents
        this.diagnostics = {
          ...this.diagnostics,
          error: null,
          fileAvailable: true,
          lastReadAt: new Date().toISOString()
        }
        return true
      } catch (cause) {
        lastError = cause
        if (attempt + 1 < this.retryCount) await delay(this.retryDelay)
      }
    }
    this.diagnostics = {
      ...this.diagnostics,
      error: lastError instanceof Error ? lastError.message : 'Unable to read NavRoute.json.',
      fileAvailable: true
    }
    this.scheduleRetry()
    return false
  }

  private scheduleRetry (): void {
    if (!this.diagnostics.watching || this.retryTimer) return
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null
      void this.refresh()
    }, Math.max(this.pollInterval, 250))
    this.retryTimer.unref()
  }
}

function delay (milliseconds: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, milliseconds))
}
