import { existsSync, readdirSync, statSync } from 'node:fs'
import { open } from 'node:fs/promises'
import { join } from 'node:path'
import type { EliteJournalBackfillDiagnostics } from '@phoenix/contracts'
import {
  EliteJournalEventSchema,
  type EliteJournalEvent,
  type EliteJournalListener
} from './elite-journal-file-source.js'

const READ_BUFFER_SIZE = 64 * 1024

export interface EliteJournalCheckpoint {
  byteOffset: number
  filePath: string
  fileSize: number
  updatedAt: string
}

export interface EliteJournalCheckpointStore {
  getJournalCheckpoint(filePath: string): EliteJournalCheckpoint | null
  putJournalCheckpoint(checkpoint: EliteJournalCheckpoint): void
}

export class EliteJournalHistoryBackfill {
  private controller: AbortController | null = null
  private task: Promise<void> | null = null
  private diagnostics: EliteJournalBackfillDiagnostics = emptyDiagnostics()

  public constructor (
    private readonly directory: string | null,
    private readonly listener: EliteJournalListener,
    private readonly checkpoints: EliteJournalCheckpointStore
  ) {}

  public start (): Promise<void> {
    if (this.task) return this.task
    this.controller = new AbortController()
    this.task = this.run(this.controller.signal)
    return this.task
  }

  public async stop (): Promise<void> {
    this.controller?.abort()
    await this.task?.catch(() => {})
    this.controller = null
    this.task = null
  }

  public getDiagnostics (): EliteJournalBackfillDiagnostics {
    return structuredClone(this.diagnostics)
  }

  private async run (signal: AbortSignal): Promise<void> {
    const files = historicalJournals(this.directory)
    const checkpoints = new Map(files.map(filePath => [
      filePath,
      normalizedOffset(this.checkpoints.getJournalCheckpoint(filePath), statSync(filePath).size)
    ]))
    this.diagnostics = {
      ...emptyDiagnostics(),
      status: 'running',
      filesDiscovered: files.length,
      filesCompleted: files.filter(filePath => checkpoints.get(filePath) === statSync(filePath).size).length,
      bytesTotal: files.reduce((total, filePath) => total + statSync(filePath).size, 0),
      bytesProcessed: files.reduce((total, filePath) => total + (checkpoints.get(filePath) ?? 0), 0),
      startedAt: new Date().toISOString()
    }

    try {
      for (const filePath of files) {
        throwIfAborted(signal)
        const fileSize = statSync(filePath).size
        const byteOffset = checkpoints.get(filePath) ?? 0
        if (byteOffset >= fileSize) continue
        this.diagnostics = { ...this.diagnostics, currentFilePath: filePath }
        await this.processFile(filePath, byteOffset, fileSize, signal)
        this.diagnostics = {
          ...this.diagnostics,
          filesCompleted: this.diagnostics.filesCompleted + 1
        }
      }
      this.diagnostics = {
        ...this.diagnostics,
        status: 'complete',
        currentFilePath: null,
        completedAt: new Date().toISOString()
      }
    } catch (cause) {
      if (signal.aborted) {
        this.diagnostics = { ...this.diagnostics, status: 'stopped', currentFilePath: null }
        return
      }
      this.diagnostics = {
        ...this.diagnostics,
        status: 'error',
        currentFilePath: null,
        completedAt: new Date().toISOString(),
        error: cause instanceof Error ? cause.message : 'Historical journal backfill failed.'
      }
    }
  }

  private async processFile (
    filePath: string,
    initialOffset: number,
    fileSize: number,
    signal: AbortSignal
  ): Promise<void> {
    const file = await open(filePath, 'r')
    let readPosition = initialOffset
    let committedOffset = initialOffset
    let carry = Buffer.alloc(0)
    try {
      while (readPosition < fileSize) {
        throwIfAborted(signal)
        const buffer = Buffer.allocUnsafe(Math.min(READ_BUFFER_SIZE, fileSize - readPosition))
        const { bytesRead } = await file.read(buffer, 0, buffer.length, readPosition)
        if (bytesRead === 0) break
        readPosition += bytesRead
        const combined = carry.length > 0
          ? Buffer.concat([carry, buffer.subarray(0, bytesRead)])
          : buffer.subarray(0, bytesRead)
        const lastNewline = combined.lastIndexOf(0x0a)
        if (lastNewline < 0) {
          carry = combined
          continue
        }
        const complete = combined.subarray(0, lastNewline)
        carry = combined.subarray(lastNewline + 1)
        await this.processLines(complete, signal)
        const nextOffset = readPosition - carry.length
        this.recordProgress(filePath, fileSize, committedOffset, nextOffset)
        committedOffset = nextOffset
        await yieldToEventLoop()
      }
      if (carry.toString('utf8').trim()) await this.processLines(carry, signal)
      this.recordProgress(filePath, fileSize, committedOffset, fileSize)
    } finally {
      await file.close()
    }
  }

  private async processLines (contents: Buffer, signal: AbortSignal): Promise<void> {
    for (const line of contents.toString('utf8').split(/\r?\n/u)) {
      throwIfAborted(signal)
      if (!line.trim()) continue
      let event: EliteJournalEvent
      try {
        event = EliteJournalEventSchema.parse(JSON.parse(line))
      } catch (cause) {
        this.diagnostics = {
          ...this.diagnostics,
          error: cause instanceof Error ? cause.message : 'Invalid historical journal line.'
        }
        continue
      }
      await this.listener(event)
      this.diagnostics = {
        ...this.diagnostics,
        linesProcessed: this.diagnostics.linesProcessed + 1
      }
    }
  }

  private recordProgress (
    filePath: string,
    fileSize: number,
    previousOffset: number,
    byteOffset: number
  ): void {
    const updatedAt = new Date().toISOString()
    this.checkpoints.putJournalCheckpoint({ byteOffset, filePath, fileSize, updatedAt })
    this.diagnostics = {
      ...this.diagnostics,
      bytesProcessed: this.diagnostics.bytesProcessed + Math.max(0, byteOffset - previousOffset)
    }
  }
}

function historicalJournals (directory: string | null): string[] {
  if (!directory || !existsSync(directory)) return []
  const journals = readdirSync(directory)
    .filter(file => /^Journal\..+\.log$/iu.test(file))
    .sort((left, right) => left.localeCompare(right))
    .map(file => join(directory, file))
  return journals.slice(0, -1)
}

function normalizedOffset (checkpoint: EliteJournalCheckpoint | null, fileSize: number): number {
  if (!checkpoint || checkpoint.byteOffset > fileSize) return 0
  return checkpoint.byteOffset
}

function emptyDiagnostics (): EliteJournalBackfillDiagnostics {
  return {
    status: 'idle',
    filesDiscovered: 0,
    filesCompleted: 0,
    bytesTotal: 0,
    bytesProcessed: 0,
    linesProcessed: 0,
    currentFilePath: null,
    startedAt: null,
    completedAt: null,
    error: null
  }
}

function throwIfAborted (signal: AbortSignal): void {
  if (signal.aborted) throw signal.reason ?? new DOMException('Backfill stopped.', 'AbortError')
}

function yieldToEventLoop (): Promise<void> {
  return new Promise(resolvePromise => setImmediate(resolvePromise))
}
