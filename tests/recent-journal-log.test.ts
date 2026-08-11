import { expect, test, vi } from 'vitest'
import type { ActivityLogEntry } from '@phoenix/contracts'
import { ActivityLogService } from '../apps/server/src/application/activity-log-service.js'

test('recent journal log is bounded, newest-first, and publishes safe copies', () => {
  const repository = new MemoryActivityRepository()
  const log = new ActivityLogService(repository, 2)
  const listener = vi.fn()
  const unsubscribe = log.subscribe(listener)

  log.ingestJournal({ timestamp: '2026-08-11T12:00:00Z', event: 'Location', StarSystem: 'Sol' })
  log.ingestJournal({ timestamp: '2026-08-11T12:01:00Z', event: 'Undocked', StationName: 'Galileo' })
  log.ingestJournal({ timestamp: '2026-08-11T12:02:00Z', event: 'FSDJump', StarSystem: 'Alpha Centauri' })
  unsubscribe()

  const recent = log.getRecent(10)
  expect(recent.retained).toBe(2)
  expect(recent.entries.map(entry => entry.event)).toEqual(['FSDJump', 'Undocked'])
  expect(listener).toHaveBeenCalledTimes(3)
  expect(listener.mock.calls[2]?.[0]).toMatchObject({ data: { StarSystem: 'Alpha Centauri' } })
})

class MemoryActivityRepository {
  private entries: ActivityLogEntry[] = []
  public getRecentActivity (limit: number) { return this.entries.slice(0, limit) }
  public putActivity (entry: ActivityLogEntry) { this.entries = [entry, ...this.entries] }
}
