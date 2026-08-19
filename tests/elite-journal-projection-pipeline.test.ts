import { expect, test, vi } from 'vitest'
import { EliteJournalProjectionPipeline } from '../apps/server/src/application/elite-journal-projection-pipeline.js'

test('journal projection retry resumes at the failed projection', async () => {
  const first = vi.fn()
  const second = vi.fn()
    .mockRejectedValueOnce(new Error('SQLite temporarily unavailable.'))
    .mockResolvedValue(undefined)
  const third = vi.fn()
  const pipeline = new EliteJournalProjectionPipeline([first, second, third])
  const event = { event: 'Docked', timestamp: '2026-08-19T12:00:00.000Z' }

  await expect(pipeline.project(event)).rejects.toThrow('SQLite temporarily unavailable.')
  await expect(pipeline.project(event)).resolves.toBeUndefined()

  expect(first).toHaveBeenCalledOnce()
  expect(second).toHaveBeenCalledTimes(2)
  expect(third).toHaveBeenCalledOnce()
})

test('journal projection retry rejects a different event until recovery completes', async () => {
  const pipeline = new EliteJournalProjectionPipeline([
    vi.fn().mockRejectedValue(new Error('Projection failed.'))
  ])

  await expect(pipeline.project({ event: 'Docked', timestamp: '2026-08-19T12:00:00.000Z' })).rejects.toThrow('Projection failed.')
  await expect(pipeline.project({ event: 'Undocked', timestamp: '2026-08-19T12:01:00.000Z' })).rejects.toThrow(
    'A different journal event arrived while projection retry was pending.'
  )
})
