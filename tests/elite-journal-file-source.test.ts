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
import { EliteJournalFileSource, type EliteJournalEvent } from '@phoenix/elite'

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

test('the journal source replays retained journals chronologically before tailing the latest file', async () => {
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
    expect(events.map(event => event.event)).toEqual(['Scan', 'Location'])
    expect(source.getDiagnostics()).toMatchObject({ linesRead: 2, lastGameTimestamp: '2026-08-10T12:00:00Z' })
  } finally {
    source.stop()
    rmSync(directory, { recursive: true, force: true })
  }
})
