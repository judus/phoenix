import { expect, test } from 'vitest'
import { GalaxyBookmarkService } from '../apps/server/src/application/galaxy-bookmark-service.js'
import { SqliteDatabase } from '../apps/server/src/infrastructure/sqlite-database.js'

test('galaxy bookmarks persist distinct system and body targets', () => {
  const database = new SqliteDatabase(':memory:')
  database.initialize()
  const times = [new Date('2026-09-11T10:00:00.000Z'), new Date('2026-09-11T10:01:00.000Z')]
  const ids = [
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000002'
  ]
  const service = new GalaxyBookmarkService(database, () => times.shift()!, () => ids.shift()!)

  try {
    const system = service.create({
      note: 'Return after the expedition.',
      tags: ['Exploration'],
      target: { kind: 'system', systemName: 'Smoje TO-Z d13-40' }
    })
    const body = service.create({
      note: null,
      tags: ['Biology'],
      target: { bodyName: 'Smoje TO-Z d13-40 3 A', kind: 'body', systemName: 'Smoje TO-Z d13-40' }
    })

    expect(service.getAll().bookmarks).toEqual([body, system])
    expect(database.findGalaxyBookmarkByTarget(system.target)?.id).toBe(system.id)
    expect(database.findGalaxyBookmarkByTarget(body.target)?.id).toBe(body.id)
  } finally {
    database.close()
  }
})

test('creating the same target updates its note and normalized tags without duplicating it', () => {
  const database = new SqliteDatabase(':memory:')
  database.initialize()
  let now = new Date('2026-09-11T10:00:00.000Z')
  const service = new GalaxyBookmarkService(
    database,
    () => now,
    () => '00000000-0000-4000-8000-000000000001'
  )

  try {
    const created = service.create({
      note: null,
      tags: ['Exploration'],
      target: { kind: 'system', systemName: 'Sol' }
    })
    now = new Date('2026-09-11T10:05:00.000Z')
    const updated = service.create({
      note: '  Visit Voyager 1.  ',
      tags: ['Historic', 'historic', 'Exploration'],
      target: { kind: 'system', systemName: 'Sol' }
    })

    expect(updated).toMatchObject({
      createdAt: created.createdAt,
      id: created.id,
      note: 'Visit Voyager 1.',
      tags: ['Exploration', 'Historic'],
      updatedAt: '2026-09-11T10:05:00.000Z'
    })
    expect(service.getAll().bookmarks).toHaveLength(1)
  } finally {
    database.close()
  }
})

test('galaxy bookmarks can be removed', () => {
  const database = new SqliteDatabase(':memory:')
  database.initialize()
  const service = new GalaxyBookmarkService(
    database,
    () => new Date('2026-09-11T10:00:00.000Z'),
    () => '00000000-0000-4000-8000-000000000001'
  )

  try {
    const bookmark = service.create({ note: null, tags: [], target: { kind: 'system', systemName: 'Sol' } })
    service.delete(bookmark.id)
    expect(service.getAll().bookmarks).toEqual([])
  } finally {
    database.close()
  }
})
