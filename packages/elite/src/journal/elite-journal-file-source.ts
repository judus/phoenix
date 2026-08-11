import {
  closeSync,
  existsSync,
  fstatSync,
  openSync,
  readSync,
  readdirSync
} from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'
import {
  EliteJournalSourceDiagnosticsSchema,
  type EliteJournalSourceDiagnostics
} from '@phoenix/contracts'

export const EliteJournalEventSchema = z.object({
  timestamp: z.iso.datetime(),
  event: z.string().min(1)
}).loose()

export type EliteJournalEvent = z.infer<typeof EliteJournalEventSchema>
export type EliteJournalListener = (event: EliteJournalEvent) => void | Promise<void>

export interface EliteJournalFileSourceOptions {
  pollInterval?: number
}

export class EliteJournalFileSource {
  private readonly pollInterval: number
  private timer: NodeJS.Timeout | null = null
  private currentFilePath: string | null = null
  private currentOffset = 0
  private carry: Buffer = Buffer.alloc(0)
  private refreshQueue: Promise<boolean> = Promise.resolve(false)
  private diagnostics: EliteJournalSourceDiagnostics

  public constructor (
    private readonly directory: string | null,
    private readonly listener: EliteJournalListener,
    options: EliteJournalFileSourceOptions = {}
  ) {
    this.pollInterval = options.pollInterval ?? 500
    this.diagnostics = {
      directory,
      filePath: null,
      watching: false,
      fileAvailable: false,
      bytesRead: 0,
      linesRead: 0,
      lastReadAt: null,
      lastGameTimestamp: null,
      error: directory ? null : 'Elite Dangerous data directory was not found.'
    }
  }

  public async start (): Promise<EliteJournalSourceDiagnostics> {
    if (!this.directory || this.diagnostics.watching) return this.getDiagnostics()
    this.diagnostics = { ...this.diagnostics, watching: true }
    await this.refresh()
    this.timer = setInterval(() => void this.refresh(), this.pollInterval)
    this.timer.unref()
    return this.getDiagnostics()
  }

  public stop (): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    this.diagnostics = { ...this.diagnostics, watching: false }
  }

  public refresh (): Promise<boolean> {
    const refresh = this.refreshQueue.then(() => this.readAvailable())
    this.refreshQueue = refresh.catch(() => false)
    return refresh
  }

  public getDiagnostics (): EliteJournalSourceDiagnostics {
    return EliteJournalSourceDiagnosticsSchema.parse(structuredClone(this.diagnostics))
  }

  private async readAvailable (): Promise<boolean> {
    try {
      const latestFile = this.findLatestJournal()
      if (!latestFile) {
        this.diagnostics = {
          ...this.diagnostics,
          filePath: null,
          fileAvailable: false,
          error: this.directory ? 'No Journal.*.log file is available.' : this.diagnostics.error
        }
        return false
      }

      if (latestFile !== this.currentFilePath) {
        this.currentFilePath = latestFile
        this.currentOffset = 0
        this.carry = Buffer.alloc(0)
      }

      const file = openSync(latestFile, 'r')
      let contents: Buffer
      try {
        const size = fstatSync(file).size
        if (size < this.currentOffset) {
          this.currentOffset = 0
          this.carry = Buffer.alloc(0)
        }
        const unreadBytes = size - this.currentOffset
        if (unreadBytes === 0) {
          this.diagnostics = {
            ...this.diagnostics,
            filePath: latestFile,
            fileAvailable: true,
            error: null
          }
          return false
        }
        contents = Buffer.allocUnsafe(unreadBytes)
        readSync(file, contents, 0, unreadBytes, this.currentOffset)
        this.currentOffset = size
      } finally {
        closeSync(file)
      }

      const combined = this.carry.length > 0
        ? Buffer.concat([this.carry, contents])
        : contents
      const lastNewline = combined.lastIndexOf(0x0a)
      this.carry = lastNewline < 0 ? combined : combined.subarray(lastNewline + 1)
      const complete = lastNewline < 0 ? Buffer.alloc(0) : combined.subarray(0, lastNewline)
      let processedLines = 0
      let lineError: string | null = null

      for (const line of complete.toString('utf8').split(/\r?\n/)) {
        if (line.trim().length === 0) continue
        try {
          const event = EliteJournalEventSchema.parse(JSON.parse(line))
          await this.listener(event)
          processedLines++
          this.diagnostics = {
            ...this.diagnostics,
            lastGameTimestamp: event.timestamp
          }
        } catch (cause) {
          lineError = cause instanceof Error ? cause.message : 'Invalid Elite journal line.'
        }
      }

      this.diagnostics = {
        ...this.diagnostics,
        filePath: latestFile,
        fileAvailable: true,
        bytesRead: this.diagnostics.bytesRead + contents.length,
        linesRead: this.diagnostics.linesRead + processedLines,
        lastReadAt: new Date().toISOString(),
        error: lineError
      }
      return processedLines > 0
    } catch (cause) {
      this.diagnostics = {
        ...this.diagnostics,
        filePath: this.currentFilePath,
        fileAvailable: this.currentFilePath !== null && existsSync(this.currentFilePath),
        error: cause instanceof Error ? cause.message : 'Unable to read the Elite journal.'
      }
      return false
    }
  }

  private findLatestJournal (): string | null {
    return this.findJournals().at(-1) ?? null
  }

  private findJournals (): string[] {
    if (!this.directory || !existsSync(this.directory)) return []
    return readdirSync(this.directory)
      .filter(file => /^Journal\..+\.log$/i.test(file))
      .sort((left, right) => left.localeCompare(right))
      .map(file => join(this.directory!, file))
  }

}
