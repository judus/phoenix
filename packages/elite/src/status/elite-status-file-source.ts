import { existsSync, readFileSync, unwatchFile, watchFile } from 'node:fs'
import { join } from 'node:path'
import {
  EliteStatusSourceDiagnosticsSchema,
  type EliteGameStatus,
  type EliteStatusSourceDiagnostics
} from '@phoenix/contracts'
import { parseEliteStatus } from './elite-status-parser.js'

export type EliteStatusListener = (status: EliteGameStatus) => void | Promise<void>

export interface EliteStatusFileSourceOptions {
  pollInterval?: number
  retryCount?: number
  retryDelay?: number
}

export class EliteStatusFileSource {
  private readonly filePath: string | null
  private readonly pollInterval: number
  private readonly retryCount: number
  private readonly retryDelay: number
  private lastContents: string | null = null
  private refreshQueue: Promise<boolean> = Promise.resolve(false)
  private diagnostics: EliteStatusSourceDiagnostics
  private readonly handleFileChange = (): void => {
    void this.refresh()
  }

  public constructor (
    private readonly directory: string | null,
    private readonly listener: EliteStatusListener,
    options: EliteStatusFileSourceOptions = {}
  ) {
    this.filePath = directory ? join(directory, 'Status.json') : null
    this.pollInterval = options.pollInterval ?? 500
    this.retryCount = options.retryCount ?? 5
    this.retryDelay = options.retryDelay ?? 25
    this.diagnostics = {
      directory,
      filePath: this.filePath,
      watching: false,
      fileAvailable: this.filePath ? existsSync(this.filePath) : false,
      lastReadAt: null,
      lastGameTimestamp: null,
      error: directory ? null : 'Elite Dangerous data directory was not found.'
    }
  }

  public async start (): Promise<EliteStatusSourceDiagnostics> {
    if (!this.filePath || this.diagnostics.watching) return this.getDiagnostics()
    this.diagnostics = { ...this.diagnostics, watching: true }
    watchFile(this.filePath, { interval: this.pollInterval }, this.handleFileChange)
    await this.refresh()
    return this.getDiagnostics()
  }

  public stop (): void {
    if (this.filePath) unwatchFile(this.filePath, this.handleFileChange)
    this.diagnostics = { ...this.diagnostics, watching: false }
  }

  public refresh (): Promise<boolean> {
    const refresh = this.refreshQueue.then(() => this.readCurrent())
    this.refreshQueue = refresh.catch(() => false)
    return refresh
  }

  public getDiagnostics (): EliteStatusSourceDiagnostics {
    return EliteStatusSourceDiagnosticsSchema.parse(structuredClone(this.diagnostics))
  }

  private async readCurrent (): Promise<boolean> {
    if (!this.filePath || !existsSync(this.filePath)) {
      this.diagnostics = {
        ...this.diagnostics,
        fileAvailable: false,
        error: this.directory ? 'Status.json is not available.' : this.diagnostics.error
      }
      return false
    }

    let lastError: unknown
    for (let attempt = 0; attempt < this.retryCount; attempt++) {
      try {
        const contents = readFileSync(this.filePath, 'utf8')
        if (contents === this.lastContents) return false
        const status = parseEliteStatus(JSON.parse(contents))
        await this.listener(status)
        this.lastContents = contents
        this.diagnostics = {
          ...this.diagnostics,
          fileAvailable: true,
          lastReadAt: new Date().toISOString(),
          lastGameTimestamp: status.timestamp,
          error: null
        }
        return true
      } catch (cause) {
        lastError = cause
        if (attempt + 1 < this.retryCount) await delay(this.retryDelay)
      }
    }

    this.diagnostics = {
      ...this.diagnostics,
      fileAvailable: true,
      error: lastError instanceof Error ? lastError.message : 'Unable to read Status.json.'
    }
    return false
  }
}

function delay (milliseconds: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, milliseconds))
}
