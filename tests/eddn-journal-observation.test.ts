import { appendFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { EliteJournalFileSource, type EliteJournalObservationSource } from '@phoenix/elite'

test('observation identity survives replay; bootstrap records are not fresh observations', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'phoenix-eddn-source-'))
  const path = join(directory, 'Journal.2026-10-04T120000.01.log')
  const line = JSON.stringify({ timestamp: '2026-10-04T12:00:00Z', event: 'Location' }) + '\n'
  writeFileSync(path, line)
  const observed: EliteJournalObservationSource[] = []
  const source = new EliteJournalFileSource(directory, () => {}, { onObservation: (_, source) => observed.push(source) })
  const restarted: EliteJournalObservationSource[] = []
  const second = new EliteJournalFileSource(directory, () => {}, { onObservation: (_, source) => restarted.push(source) })
  try {
    await source.refresh()
    appendFileSync(path, line)
    await source.refresh()
    expect(observed.map(source => source.replayed)).toEqual([true, false])
    expect(observed[0].id).not.toBe(observed[1].id)
    await second.refresh()
    expect(restarted.map(source => source.id)).toEqual(observed.map(source => source.id))
    expect(restarted.every(source => source.replayed)).toBe(true)
    writeFileSync(join(directory, 'Journal.2026-10-04T130000.01.log'), line)
    await source.refresh()
    expect(observed.at(-1)?.replayed).toBe(false)
  } finally {
    source.stop()
    second.stop()
    rmSync(directory, { recursive: true, force: true })
  }
})
