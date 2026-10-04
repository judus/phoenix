import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { expect, test } from 'vitest'
import { SqliteEddnOutbox } from '../apps/server/src/infrastructure/sqlite-eddn-outbox.js'
import { EDDN_MAX_AGE_MS, type EddnMessage } from '../apps/server/src/domain/eddn.js'

test('pending data, retry reservations, receipts and acknowledgement survive database reopen', () => {
  const directory = mkdtempSync(join(tmpdir(), 'phoenix-eddn-db-'))
  const path = join(directory, 'outbox.sqlite')
  const now = Date.parse('2026-10-04T18:00:00Z')
  const message: EddnMessage = { $schemaRef: 'https://eddn.edcd.io/schemas/journal/1/test',
    header: { softwareName: 'PHOENIX', softwareVersion: '0.1.2', uploaderID: 'Test', gameversion: '4.0', gamebuild: 'r1' },
    message: { timestamp: new Date(now).toISOString(), event: 'Location', StarSystem: 'Sol', SystemAddress: 123, StarPos: [0, 0, 0] } }
  let connection = new DatabaseSync(path)
  try {
    let outbox = new SqliteEddnOutbox(connection)
    outbox.initialize()
    expect(outbox.enqueue('one', message, now)).toBe(true)
    outbox.beginAttempt('one', now + 75_000)
    connection.close()
    connection = new DatabaseSync(path)
    outbox = new SqliteEddnOutbox(connection)
    outbox.initialize()
    expect(outbox.next(now)).toBeUndefined()
    expect(outbox.next(now + 75_000)).toMatchObject({ id: 'one', attempts: 1, message })
    outbox.acknowledge('one', now + 75_000)
    connection.close()
    connection = new DatabaseSync(path)
    outbox = new SqliteEddnOutbox(connection)
    outbox.initialize()
    expect(outbox.status()).toEqual({ queued: 0, lastSuccessAt: new Date(now + 75_000).toISOString() })
    expect(outbox.enqueue('one', message, now + 80_000)).toBe(false)
    outbox.enqueue('two', message, now)
    outbox.prune(now + EDDN_MAX_AGE_MS)
    expect(outbox.status().queued).toBe(0)
    expect((connection.prepare('SELECT COUNT(*) AS count FROM eddn_receipts').get() as { count: number }).count).toBe(0)
  } finally { connection.close(); rmSync(directory, { recursive: true, force: true }) }
})
