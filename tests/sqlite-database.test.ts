import { expect, test } from 'vitest'
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
