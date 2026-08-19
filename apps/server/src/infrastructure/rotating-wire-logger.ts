import { appendFileSync, existsSync, renameSync, rmSync, statSync } from 'node:fs'
import { dirname } from 'node:path'
import { ensurePrivateDirectorySync, PRIVATE_FILE_MODE, restrictPrivateFileSync } from './private-user-state.js'

export interface RotatingWireLoggerOptions {
  file: string
  maxBytes?: number
  maxFiles?: number
}

export class RotatingWireLogger {
  private readonly maxBytes: number
  private readonly maxFiles: number

  public constructor (private readonly options: RotatingWireLoggerOptions) {
    this.maxBytes = boundedFileSize(options.maxBytes ?? 25 * 1024 * 1024)
    this.maxFiles = positiveInteger(options.maxFiles ?? 3, 'wire log maxFiles')
    ensurePrivateDirectorySync(dirname(options.file))
    for (let index = 0; index < this.maxFiles; index++) {
      restrictPrivateFileSync(index === 0 ? options.file : `${options.file}.${index}`)
    }
  }

  public write = (event: unknown): void => {
    let line = `${JSON.stringify(event, wireLogReplacer)}\n`
    const bytes = Buffer.byteLength(line)
    if (bytes > this.maxBytes) {
      line = `${JSON.stringify({
        at: new Date().toISOString(),
        originalBytes: bytes,
        reason: 'event_exceeds_file_limit',
        type: 'wire_log.event_omitted'
      })}\n`
    }
    if (this.currentBytes() + Buffer.byteLength(line) > this.maxBytes) this.rotate()
    appendFileSync(this.options.file, line, { encoding: 'utf8', mode: PRIVATE_FILE_MODE })
    restrictPrivateFileSync(this.options.file)
  }

  private currentBytes (): number {
    return existsSync(this.options.file) ? statSync(this.options.file).size : 0
  }

  private rotate (): void {
    if (this.maxFiles === 1) {
      rmSync(this.options.file, { force: true })
      return
    }
    rmSync(`${this.options.file}.${this.maxFiles - 1}`, { force: true })
    for (let index = this.maxFiles - 1; index >= 2; index -= 1) {
      const source = `${this.options.file}.${index - 1}`
      if (existsSync(source)) renameSync(source, `${this.options.file}.${index}`)
    }
    if (existsSync(this.options.file)) renameSync(this.options.file, `${this.options.file}.1`)
  }
}

function wireLogReplacer (key: string, value: unknown): unknown {
  if (/^(?:api[_-]?key|authorization|access[_-]?token|client[_-]?secret)$/i.test(key)) return '[REDACTED]'
  if (typeof value === 'bigint') return value.toString()
  if (value instanceof Error) {
    return {
      cause: value.cause,
      message: value.message,
      name: value.name,
      stack: value.stack
    }
  }
  return value
}

function positiveInteger (value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(`${name} must be a positive integer.`)
  return value
}

function boundedFileSize (value: number): number {
  if (!Number.isSafeInteger(value) || value < 128) {
    throw new Error('wire log maxBytes must be an integer of at least 128 bytes.')
  }
  return value
}
