import { existsSync, readFileSync, unwatchFile, watchFile } from 'node:fs'
import { join } from 'node:path'
import {
  EliteInventorySourceDiagnosticsSchema,
  type EliteInventoryFileSnapshot,
  type EliteInventorySourceDiagnostics,
  type EliteWatchedFileDiagnostics
} from '@phoenix/contracts'
import { parseEliteInventoryFile } from './elite-inventory-parser.js'

const INVENTORY_FILES = ['Cargo.json', 'ShipLocker.json', 'Backpack.json'] as const

export type EliteInventoryListener = (snapshot: EliteInventoryFileSnapshot) => void | Promise<void>

export interface EliteInventoryFileSourceOptions {
  pollInterval?: number
  retryCount?: number
  retryDelay?: number
}

export class EliteInventoryFileSource {
  private readonly filePaths: string[]
  private readonly pollInterval: number
  private readonly retryCount: number
  private readonly retryDelay: number
  private readonly lastContents = new Map<string, string>()
  private refreshQueue: Promise<boolean> = Promise.resolve(false)
  private retryTimer: NodeJS.Timeout | null = null
  private readonly handleFileChange = (): void => { void this.refresh() }
  private diagnostics: EliteInventorySourceDiagnostics

  public constructor (
    directory: string | null,
    private readonly listener: EliteInventoryListener,
    options: EliteInventoryFileSourceOptions = {}
  ) {
    this.filePaths = directory ? INVENTORY_FILES.map(file => join(directory, file)) : []
    this.pollInterval = options.pollInterval ?? 500
    this.retryCount = options.retryCount ?? 5
    this.retryDelay = options.retryDelay ?? 25
    this.diagnostics = {
      directory,
      error: directory ? null : 'Elite Dangerous data directory was not found.',
      files: this.filePaths.map(filePath => ({
        error: null,
        fileAvailable: existsSync(filePath),
        filePath,
        lastReadAt: null
      })),
      watching: false
    }
  }

  public async start (): Promise<EliteInventorySourceDiagnostics> {
    if (this.filePaths.length === 0 || this.diagnostics.watching) return this.getDiagnostics()
    this.diagnostics = { ...this.diagnostics, watching: true }
    for (const filePath of this.filePaths) {
      watchFile(filePath, { interval: this.pollInterval }, this.handleFileChange)
    }
    await this.refresh()
    return this.getDiagnostics()
  }

  public stop (): void {
    for (const filePath of this.filePaths) unwatchFile(filePath, this.handleFileChange)
    if (this.retryTimer) clearTimeout(this.retryTimer)
    this.retryTimer = null
    this.diagnostics = { ...this.diagnostics, watching: false }
  }

  public refresh (): Promise<boolean> {
    const refresh = this.refreshQueue.then(() => this.readAvailable())
    this.refreshQueue = refresh.catch(() => false)
    return refresh
  }

  public getDiagnostics (): EliteInventorySourceDiagnostics {
    return EliteInventorySourceDiagnosticsSchema.parse(structuredClone(this.diagnostics))
  }

  private async readAvailable (): Promise<boolean> {
    let changed = false
    for (const filePath of this.filePaths) {
      if (!existsSync(filePath)) {
        this.updateFile(filePath, { fileAvailable: false })
        continue
      }
      changed = await this.readFile(filePath) || changed
    }
    return changed
  }

  private async readFile (filePath: string): Promise<boolean> {
    let lastError: unknown
    for (let attempt = 0; attempt < this.retryCount; attempt++) {
      try {
        const contents = readFileSync(filePath, 'utf8')
        if (contents === this.lastContents.get(filePath)) {
          this.updateFile(filePath, { fileAvailable: true })
          return false
        }
        await this.listener(parseEliteInventoryFile(JSON.parse(contents)))
        this.lastContents.set(filePath, contents)
        this.updateFile(filePath, { error: null, fileAvailable: true, lastReadAt: new Date().toISOString() })
        return true
      } catch (cause) {
        lastError = cause
        if (attempt + 1 < this.retryCount) await delay(this.retryDelay)
      }
    }
    this.updateFile(filePath, {
      error: lastError instanceof Error ? lastError.message : `Unable to read ${filePath}.`,
      fileAvailable: true
    })
    this.scheduleRetry()
    return false
  }

  private updateFile (filePath: string, update: Partial<EliteWatchedFileDiagnostics>): void {
    this.diagnostics = {
      ...this.diagnostics,
      files: this.diagnostics.files.map(file => file.filePath === filePath ? { ...file, ...update } : file)
    }
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
