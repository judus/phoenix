import { existsSync, readFileSync, unwatchFile, watchFile } from 'node:fs'
import { join } from 'node:path'
import type { EliteInventoryFileSnapshot } from '@phoenix/contracts'
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
  private readonly handleFileChange = (): void => { void this.refresh() }
  private watching = false

  public constructor (
    directory: string | null,
    private readonly listener: EliteInventoryListener,
    options: EliteInventoryFileSourceOptions = {}
  ) {
    this.filePaths = directory ? INVENTORY_FILES.map(file => join(directory, file)) : []
    this.pollInterval = options.pollInterval ?? 500
    this.retryCount = options.retryCount ?? 5
    this.retryDelay = options.retryDelay ?? 25
  }

  public async start (): Promise<void> {
    if (this.watching) return
    this.watching = true
    for (const filePath of this.filePaths) {
      watchFile(filePath, { interval: this.pollInterval }, this.handleFileChange)
    }
    await this.refresh()
  }

  public stop (): void {
    for (const filePath of this.filePaths) unwatchFile(filePath, this.handleFileChange)
    this.watching = false
  }

  public refresh (): Promise<boolean> {
    const refresh = this.refreshQueue.then(() => this.readAvailable())
    this.refreshQueue = refresh.catch(() => false)
    return refresh
  }

  private async readAvailable (): Promise<boolean> {
    let changed = false
    for (const filePath of this.filePaths) {
      if (!existsSync(filePath)) continue
      changed = await this.readFile(filePath) || changed
    }
    return changed
  }

  private async readFile (filePath: string): Promise<boolean> {
    for (let attempt = 0; attempt < this.retryCount; attempt++) {
      try {
        const contents = readFileSync(filePath, 'utf8')
        if (contents === this.lastContents.get(filePath)) return false
        await this.listener(parseEliteInventoryFile(JSON.parse(contents)))
        this.lastContents.set(filePath, contents)
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
