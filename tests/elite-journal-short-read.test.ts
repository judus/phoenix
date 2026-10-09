import { appendFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, expect, test, vi } from 'vitest'
import { EliteJournalFileSource, type EliteJournalEvent, type EliteJournalObservationSource } from '@phoenix/elite'

const fault = vi.hoisted(() => ({
  limit: undefined as number | undefined,
  truncateTo: undefined as { path: string, size: number } | undefined,
  positions: [] as number[]
}))

vi.mock('node:fs', async importOriginal => {
  const fs = await importOriginal<typeof import('node:fs')>()
  return {
    ...fs,
    readSync(fd: number, buffer: Buffer, offset: number, length: number, position: number) {
      fault.positions.push(position)
      if (fault.truncateTo !== undefined) {
        fs.truncateSync(fault.truncateTo.path, fault.truncateTo.size)
        fault.truncateTo = undefined
      }
      // Make incorrect parsing of the unread tail deterministically advance offsets.
      buffer.fill(0x0a)
      const limit = fault.limit
      fault.limit = undefined
      return fs.readSync(fd, buffer, offset, Math.min(length, limit ?? length), position)
    }
  }
})

afterEach(() => {
  fault.limit = undefined
  fault.truncateTo = undefined
  fault.positions = []
})

const line = (event: string) => JSON.stringify({ timestamp: '2026-08-10T12:00:00Z', event, BodyName: 'Synthetic é' }) + '\n'
const first = line('Location'), second = line('Scan'), third = line('Docked')
const firstLength = Buffer.byteLength(first)

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'phoenix-journal-short-read-'))
  const path = join(directory, 'Journal.2026-08-10T120000.01.log')
  writeFileSync(path, first + second)
  const events: EliteJournalEvent[] = [], observations: EliteJournalObservationSource[] = []
  const source = new EliteJournalFileSource(directory, event => { events.push(event) }, {
    onObservation: (_event, observation) => { observations.push(observation) }
  })
  return { source, events, observations, path, dispose() { source.stop(); rmSync(directory, { recursive: true, force: true }) } }
}

test.each([0, firstLength - 2, firstLength, firstLength + 12])(
  'a %i-byte short read consumes only complete returned records and retries the rest', async limit => {
    const { source, events, observations, path, dispose } = fixture()
    try {
      fault.limit = limit
      const completedFirst = limit >= firstLength
      expect(await source.refresh()).toBe(completedFirst)
      expect(events.map(event => event.event)).toEqual(completedFirst ? ['Location'] : [])
      expect(source.getDiagnostics()).toMatchObject({ bytesRead: completedFirst ? firstLength : 0, error: null })

      expect(await source.refresh()).toBe(true)
      expect(events.map(event => event.event)).toEqual(['Location', 'Scan'])
      expect(fault.positions).toEqual([0, completedFirst ? firstLength : 0])
      expect(source.getDiagnostics()).toMatchObject({ bytesRead: Buffer.byteLength(first + second), linesRead: 2, error: null })
      expect(observations.map(observation => observation.replayed)).toEqual([true, true])
      appendFileSync(path, third)
      expect(await source.refresh()).toBe(true)
      expect(events.map(event => event.event)).toEqual(['Location', 'Scan', 'Docked'])
      expect(observations.at(-1)?.replayed).toBe(false)
      expect(new Set(observations.map(observation => observation.id)).size).toBe(3)
      expect(await source.refresh()).toBe(false)
    } finally { dispose() }
  }
)

test('truncation between stat and read never consumes the unread tail or skips later appends', async () => {
  const { source, events, path, dispose } = fixture()
  try {
    fault.truncateTo = { path, size: firstLength }
    expect(await source.refresh()).toBe(true)
    expect(events.map(event => event.event)).toEqual(['Location'])
    expect(source.getDiagnostics()).toMatchObject({ bytesRead: firstLength, linesRead: 1, error: null })
    appendFileSync(path, second)
    expect(await source.refresh()).toBe(true)
    expect(fault.positions).toEqual([0, firstLength])
    expect(events.map(event => event.event)).toEqual(['Location', 'Scan'])
  } finally { dispose() }
})

test('a short read during rotation retries the old tail before advancing to the new file', async () => {
  const { source, events, path, dispose } = fixture()
  try {
    await source.refresh()
    appendFileSync(path, second + third)
    writeFileSync(join(dirname(path), 'Journal.2026-08-10T130000.01.log'), line('Fileheader'))
    fault.limit = Buffer.byteLength(second)
    await source.refresh()
    expect(events.map(event => event.event)).toEqual(['Location', 'Scan', 'Scan'])
    await source.refresh()
    expect(events.map(event => event.event)).toEqual(['Location', 'Scan', 'Scan', 'Docked', 'Fileheader'])
  } finally { dispose() }
})
