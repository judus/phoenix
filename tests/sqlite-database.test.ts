import { expect, test } from 'vitest'
import { ActivityLogService } from '../apps/server/src/application/activity-log-service.js'
import { SqliteDatabase } from '../apps/server/src/infrastructure/sqlite-database.js'

test('SQLite initializes and reports a healthy connection', () => {
  const database = new SqliteDatabase(':memory:')

  try {
    database.initialize()
    expect(database.health()).toEqual({ connected: true, engine: 'sqlite' })
  } finally {
    database.close()
  }
})

test('SQLite persists journal backfill checkpoints', () => {
  const database = new SqliteDatabase(':memory:')

  try {
    database.initialize()
    database.putJournalCheckpoint({
      byteOffset: 4096,
      filePath: '/journals/Journal.test.log',
      fileSize: 8192,
      updatedAt: '2026-08-11T12:00:00.000Z'
    })
    expect(database.getJournalCheckpoint('/journals/Journal.test.log')).toEqual({
      byteOffset: 4096,
      filePath: '/journals/Journal.test.log',
      fileSize: 8192,
      updatedAt: '2026-08-11T12:00:00.000Z'
    })
    database.initialize()
    expect(database.getJournalCheckpoint('/journals/Journal.test.log')).not.toBeNull()
  } finally {
    database.close()
  }
})

test('journal activity is idempotent across replay', () => {
  const database = new SqliteDatabase(':memory:')

  try {
    database.initialize()
    const activity = new ActivityLogService(database)
    const event = { timestamp: '2026-08-11T12:00:00Z', event: 'FSDJump', StarSystem: 'Sol' }
    activity.ingestJournal(event, 'historical')
    activity.ingestJournal(event, 'historical')
    expect(activity.getRecent().retained).toBe(1)
  } finally {
    database.close()
  }
})
