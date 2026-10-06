import {
  closeSync,
  existsSync,
  fstatSync,
  openSync,
  readSync,
  readdirSync
} from 'node:fs'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
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

const LINES_PER_TURN = 256

export interface EliteJournalFileSourceOptions {
  pollInterval?: number
  onObservation?: (event: EliteJournalEvent, source: EliteJournalObservationSource) => void
}

export interface EliteJournalObservationSource {
  id: string
  replayed: boolean
}

export class EliteJournalFileSource {
  private readonly pollInterval: number
  private timer: NodeJS.Timeout | null = null
  private currentFilePath: string | null = null
  private currentOffset = 0
  private refreshQueue: Promise<boolean> = Promise.resolve(false)
  private diagnostics: EliteJournalSourceDiagnostics
  private bootstrap: { path: string, end: number } | undefined

  public constructor (
    private readonly directory: string | null,
    private readonly listener: EliteJournalListener,
    private readonly options: EliteJournalFileSourceOptions = {}
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

  public async stop (): Promise<void> {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    this.diagnostics = { ...this.diagnostics, watching: false }
    // A yielded or asynchronous projection still owns its downstream dependencies.
    await this.refreshQueue
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
      }

      const file = openSync(latestFile, 'r')
      let contents: Buffer
      try {
        const size = fstatSync(file).size
        this.bootstrap ??= { path: latestFile, end: size }
        if (size < this.currentOffset) {
          this.currentOffset = 0
        }
        const unreadBytes = size - this.currentOffset
        if (unreadBytes === 0) {
          this.diagnostics = {
            ...this.diagnostics,
            filePath: latestFile,
            fileAvailable: true,
            error: this.diagnostics.filePath === latestFile ? this.diagnostics.error : null
          }
          return false
        }
        contents = Buffer.allocUnsafe(unreadBytes)
        const bytesRead = readSync(file, contents, 0, unreadBytes, this.currentOffset)
        contents = contents.subarray(0, bytesRead)
      } finally {
        closeSync(file)
      }

      const initialOffset = this.currentOffset
      let processedLines = 0
      let lineError: string | null = null
      let lineStart = 0
      let newline = contents.indexOf(0x0a, lineStart)
      let linesThisTurn = 0
      while (newline >= 0) {
        if (linesThisTurn === LINES_PER_TURN) {
          await new Promise<void>(resolvePromise => setImmediate(resolvePromise))
          linesThisTurn = 0
        }
        linesThisTurn++
        const nextOffset = initialOffset + newline + 1
        const line = contents.subarray(lineStart, newline).toString('utf8')
        lineStart = newline + 1
        if (line.trim().length === 0) {
          this.currentOffset = nextOffset
          newline = contents.indexOf(0x0a, lineStart)
          continue
        }
        let event: EliteJournalEvent
        try {
          event = EliteJournalEventSchema.parse(JSON.parse(line))
        } catch (cause) {
          lineError = cause instanceof Error ? cause.message : 'Invalid Elite journal line.'
          this.currentOffset = nextOffset
          newline = contents.indexOf(0x0a, lineStart)
          continue
        }
        try {
          await this.listener(event)
          this.options.onObservation?.(event, {
            id: createHash('sha256').update(`${latestFile}\n${nextOffset}\n${line}`).digest('hex'),
            replayed: latestFile === this.bootstrap!.path && nextOffset <= this.bootstrap!.end
          })
          this.currentOffset = nextOffset
          processedLines++
          this.diagnostics = {
            ...this.diagnostics,
            lastGameTimestamp: event.timestamp
          }
        } catch (cause) {
          lineError = cause instanceof Error ? cause.message : 'Invalid Elite journal line.'
          break
        }
        newline = contents.indexOf(0x0a, lineStart)
      }

      this.diagnostics = {
        ...this.diagnostics,
        filePath: latestFile,
        fileAvailable: true,
        bytesRead: this.diagnostics.bytesRead + this.currentOffset - initialOffset,
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
