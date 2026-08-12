import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs'
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
    expect(JSON.parse(readFileSync(file, 'utf8'))).toMatchObject({
      originalBytes: expect.any(Number),
      type: 'wire_log.event_omitted'
    })
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
