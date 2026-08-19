import {
  appendFileSync,
  copyFileSync,
  mkdtempSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from 'vitest'
import {
  EliteJournalFileSource,
  EliteJournalHistoryBackfill,
  type EliteJournalCheckpoint,
  type EliteJournalCheckpointStore,
  type EliteJournalEvent
} from '@phoenix/elite'

const fixturePath = fileURLToPath(
  new URL('./fixtures/elite/Journal.2026-08-10T120000.01.log', import.meta.url)
)

test('the journal source replays, tails partial writes and follows journal rotation', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'phoenix-journal-source-'))
  const firstJournal = join(directory, basename(fixturePath))
  const events: EliteJournalEvent[] = []
  copyFileSync(fixturePath, firstJournal)
  const source = new EliteJournalFileSource(directory, event => events.push(event), {
    pollInterval: 60_000
  })

  try {
    await source.start()
    expect(events.map(event => event.event)).toEqual([
      'Fileheader',
      'Commander',
      'Rank',
      'Progress',
      'Location',
      'Loadout',
      'Cargo',
      'Materials',
      'ShipLocker',
      'BackpackMaterials',
      'MaterialCollected',
      'MaterialTrade'
    ])

    appendFileSync(firstJournal, '{"timestamp":"2026-08-10T12:01:00Z","event":"Undocked"')
    expect(await source.refresh()).toBe(false)
    expect(events.at(-1)?.event).toBe('MaterialTrade')

    appendFileSync(firstJournal, '}\n')
    expect(await source.refresh()).toBe(true)
    expect(events.at(-1)?.event).toBe('Undocked')

    const secondJournal = join(directory, 'Journal.2026-08-10T130000.01.log')
    writeFileSync(secondJournal, '{"timestamp":"2026-08-10T13:00:00Z","event":"Fileheader"}\n')
    expect(await source.refresh()).toBe(true)
    expect(source.getDiagnostics()).toMatchObject({
      filePath: secondJournal,
      watching: true,
      fileAvailable: true,
      lastGameTimestamp: '2026-08-10T13:00:00Z',
      error: null
    })
  } finally {
    source.stop()
    rmSync(directory, { recursive: true, force: true })
  }
})

test('the live journal source reads only the latest file during startup', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'phoenix-journal-history-'))
  const events: EliteJournalEvent[] = []
  writeFileSync(
    join(directory, 'Journal.2026-08-09T120000.01.log'),
    '{"timestamp":"2026-08-09T12:00:00Z","event":"Scan","BodyName":"Old body"}\n'
  )
  writeFileSync(
    join(directory, 'Journal.2026-08-10T120000.01.log'),
    '{"timestamp":"2026-08-10T12:00:00Z","event":"Location","StarSystem":"Current system"}\n'
  )
  const source = new EliteJournalFileSource(directory, event => events.push(event), {
    pollInterval: 60_000
  })

  try {
    await source.start()
    expect(events.map(event => event.event)).toEqual(['Location'])
    expect(source.getDiagnostics()).toMatchObject({ linesRead: 1, lastGameTimestamp: '2026-08-10T12:00:00Z' })
  } finally {
    source.stop()
    rmSync(directory, { recursive: true, force: true })
  }
})

test('the live journal source retries a line when its listener fails', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'phoenix-journal-retry-'))
  const journal = join(directory, 'Journal.2026-08-10T120000.01.log')
  writeFileSync(journal, [
    '{"timestamp":"2026-08-10T12:00:00Z","event":"Docked"}',
    '{"timestamp":"2026-08-10T12:01:00Z","event":"Undocked"}',
    ''
  ].join('\n'))
  const events: EliteJournalEvent[] = []
  let attempts = 0
  const source = new EliteJournalFileSource(directory, event => {
    attempts++
    if (attempts === 1) throw new Error('Projection temporarily unavailable.')
    events.push(event)
  })

  try {
    expect(await source.refresh()).toBe(false)
    expect(source.getDiagnostics()).toMatchObject({
      error: 'Projection temporarily unavailable.',
      linesRead: 0
    })

    expect(await source.refresh()).toBe(true)
    expect(events.map(event => event.event)).toEqual(['Docked', 'Undocked'])
    expect(source.getDiagnostics()).toMatchObject({ error: null, linesRead: 2 })
  } finally {
    source.stop()
    rmSync(directory, { recursive: true, force: true })
  }
})

test('historical journal backfill resumes from durable file checkpoints', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'phoenix-journal-backfill-'))
  const oldJournal = join(directory, 'Journal.2026-08-09T120000.01.log')
  const checkpoints = new MemoryCheckpointStore()
  const events: EliteJournalEvent[] = []
  writeFileSync(
    oldJournal,
    [
      '{"timestamp":"2026-08-09T12:00:00Z","event":"Scan","BodyName":"Old body"}',
      '{"timestamp":"2026-08-09T12:01:00Z","event":"FSSAllBodiesFound","SystemName":"Old system"}',
      ''
    ].join('\n')
  )
  writeFileSync(
    join(directory, 'Journal.2026-08-10T120000.01.log'),
    '{"timestamp":"2026-08-10T12:00:00Z","event":"Location","StarSystem":"Current system"}\n'
  )

  try {
    const first = new EliteJournalHistoryBackfill(directory, event => events.push(event), checkpoints)
    await first.start()
    expect(events.map(event => event.event)).toEqual(['Scan', 'FSSAllBodiesFound'])
    expect(first.getDiagnostics()).toMatchObject({
      status: 'complete',
      filesDiscovered: 1,
      filesCompleted: 1,
      linesProcessed: 2
    })
    expect(checkpoints.getJournalCheckpoint(oldJournal)?.byteOffset).toBeGreaterThan(0)

    const secondEvents: EliteJournalEvent[] = []
    const second = new EliteJournalHistoryBackfill(
      directory,
      event => secondEvents.push(event),
      checkpoints
    )
    await second.start()
    expect(secondEvents).toEqual([])
    expect(second.getDiagnostics()).toMatchObject({
      status: 'complete',
      filesCompleted: 1,
      linesProcessed: 0
    })
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

class MemoryCheckpointStore implements EliteJournalCheckpointStore {
  private readonly checkpoints = new Map<string, EliteJournalCheckpoint>()

  public getJournalCheckpoint (filePath: string): EliteJournalCheckpoint | null {
    return this.checkpoints.get(filePath) ?? null
  }

  public putJournalCheckpoint (checkpoint: EliteJournalCheckpoint): void {
    this.checkpoints.set(checkpoint.filePath, checkpoint)
  }
}
