import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { RotatingWireLogger } from '../apps/server/src/infrastructure/rotating-wire-logger.js'

test('wire logs redact secrets and rotate within configured bounds', () => {
  const directory = mkdtempSync(join(tmpdir(), 'phoenix-wire-log-'))
  const file = join(directory, 'openai.ndjson')
  const logger = new RotatingWireLogger({ file, maxBytes: 180, maxFiles: 2 })

  try {
    for (let index = 0; index < 8; index += 1) {
      logger.write({ authorization: 'Bearer secret', index, payload: 'x'.repeat(36) })
    }

    expect(readFileSync(file, 'utf8')).not.toContain('Bearer secret')
    expect(readFileSync(`${file}.1`, 'utf8')).not.toContain('Bearer secret')
    expect(statSync(file).size).toBeLessThanOrEqual(180)
    expect(statSync(`${file}.1`).size).toBeLessThanOrEqual(180)
    expect(readdirSync(directory).sort()).toEqual(['openai.ndjson', 'openai.ndjson.1'])
    const records = [`${file}.1`, file].flatMap(path => readFileSync(path, 'utf8').trim().split('\n').map(line => JSON.parse(line)))
    expect(records.map(record => record.index)).toEqual([4, 5, 6, 7])
    expect(records.every(record => record.authorization === '[REDACTED]')).toBe(true)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('oversized wire events are replaced with a bounded valid record', () => {
  const directory = mkdtempSync(join(tmpdir(), 'phoenix-wire-log-'))
  const file = join(directory, 'openai.ndjson')
  const logger = new RotatingWireLogger({ file, maxBytes: 160, maxFiles: 1 })

  try {
    logger.write({ payload: 'x'.repeat(1_000) })
    expect(statSync(file).size).toBeLessThanOrEqual(160)
    expect(JSON.parse(readFileSync(file, 'utf8'))).toMatchObject({
      originalBytes: expect.any(Number),
      type: 'wire_log.event_omitted'
    })
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
