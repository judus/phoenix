import { appendFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { EliteJournalFileSource, type EliteJournalEvent } from '@phoenix/elite'

function fixture(contents: string, listener: (event: EliteJournalEvent) => void | Promise<void>) {
  const directory = mkdtempSync(join(tmpdir(), 'phoenix-journal-fairness-'))
  const path = join(directory, 'Journal.2026-01-01T000000.01.log')
  writeFileSync(path, contents)
  const source = new EliteJournalFileSource(directory, listener)
  return { source, path, async dispose() { await source.stop(); rmSync(directory, { recursive: true, force: true }) } }
}

function records(count: number) {
  return Array.from({ length: count }, (_, id) => JSON.stringify({ timestamp: '2026-01-01T00:00:00Z', event: 'Progress', id }) + '\n')
}

test('live ingestion gives queued I/O a turn while retaining exact projection order', async () => {
  const lines = records(2048), ids: number[] = []
  const { source, dispose } = fixture(lines.join(''), event => { ids.push(Number(event.id)) })
  let observed = -1
  const turn = new Promise<void>(resolve => setImmediate(() => { observed = ids.length; resolve() }))
  try {
    await source.refresh()
    await turn
    expect(observed).toBeGreaterThan(0)
    expect(observed).toBeLessThan(lines.length)
    expect(ids).toEqual(Array.from({ length: lines.length }, (_, id) => id))
    expect(source.getDiagnostics()).toMatchObject({ linesRead: lines.length, bytesRead: Buffer.byteLength(lines.join('')), error: null })
    expect(await source.refresh()).toBe(false)
  } finally { await dispose() }
})

test('blank and invalid records also yield instead of starving the event loop', async () => {
  const { source, dispose } = fixture(('\nnot-json\n').repeat(2048), () => { throw new Error('No valid event expected') })
  let finished = false, observed = true
  const turn = new Promise<void>(resolve => setImmediate(() => { observed = finished; resolve() }))
  try {
    await source.refresh()
    finished = true
    await turn
    expect(observed).toBe(false)
    expect(source.getDiagnostics()).toMatchObject({ linesRead: 0, bytesRead: Buffer.byteLength(('\nnot-json\n').repeat(2048)) })
  } finally { await dispose() }
})

test('projection retry after a yield resumes the failed record, retaining partial tail bytes', async () => {
  const lines = records(1024), ids: number[] = []
  let fail = true
  const { source, path, dispose } = fixture(lines.join('') + '{"timestamp":', event => {
    if (event.id === 700 && fail) { fail = false; throw new Error('Retry fixture') }
    ids.push(Number(event.id))
  })
  try {
    await source.refresh()
    expect(ids).toHaveLength(700)
    expect(source.getDiagnostics()).toMatchObject({ linesRead: 700, error: 'Retry fixture' })
    await source.refresh()
    expect(ids).toEqual(Array.from({ length: lines.length }, (_, id) => id))
    expect(source.getDiagnostics()).toMatchObject({ linesRead: 1024, bytesRead: Buffer.byteLength(lines.join('')), error: null })
    appendFileSync(path, '"2026-01-01T00:00:00Z","event":"Progress","id":1024}\n')
    await source.refresh()
    expect(ids.at(-1)).toBe(1024)
  } finally { await dispose() }
})

test('stop waits for active and queued refreshes before downstream resources can close', async () => {
  const ids: number[] = []
  const { source, dispose } = fixture(records(2048).join(''), event => { ids.push(Number(event.id)) })
  const active = source.refresh()
  const queued = source.refresh()
  let stoppedAt = -1
  const stopping = new Promise<void>((resolve, reject) => setImmediate(() => {
    source.stop().then(() => { stoppedAt = ids.length; resolve() }, reject)
  }))
  try {
    await stopping
    expect(stoppedAt).toBe(2048)
    expect(await active).toBe(true)
    expect(await queued).toBe(false)
    expect(source.getDiagnostics().watching).toBe(false)
  } finally { await dispose() }
})
