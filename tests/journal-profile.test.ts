import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { expect, test } from 'vitest'
import { journalRecords } from '../scripts/diagnostics/journal-profile.mjs'

const run = promisify(execFile)
const script = fileURLToPath(new URL('../scripts/diagnostics/journal-profile.mjs', import.meta.url))

test('synthetic workloads are deterministic, complete records with distinct offsets', () => {
  const first = journalRecords(300)
  expect(first).toBe(journalRecords(300))
  expect(first.endsWith('\n')).toBe(true)
  const parsed = first.trimEnd().split('\n').map(line => JSON.parse(line))
  expect(parsed).toHaveLength(300)
  expect(new Set(parsed.map(event => event.timestamp)).size).toBe(300)
  expect(new Set(parsed.map(event => event.event))).toEqual(new Set(['FSDJump', 'Progress', 'FuelScoop', 'ReceiveText']))
  expect(journalRecords(1, 300)).not.toBe(journalRecords(1))
})

test('isolated diagnostic exercises bootstrap, tail, reset, history and checkpoints with real HTTP/SSE', async () => {
  const { stdout } = await run(process.execPath, ['--import', 'tsx', script, '--small=8', '--large=32', '--repeats=1'], { timeout: 25_000 })
  const report = JSON.parse(stdout)
  expect(report.environment.node).toBe(process.version)
  expect(report.results).toHaveLength(2)
  for (const sample of report.results) {
    expect(sample.phases.bootstrap.linesProcessed).toBe(sample.lines)
    expect(sample.phases.tail.linesProcessed).toBe(sample.lines)
    expect(sample.phases.reset.linesProcessed).toBe(Math.floor(sample.lines / 10) || 1)
    expect(sample.phases.history.history.linesProcessed).toBe(sample.lines)
    expect(sample.phases.checkpoint.history.linesProcessed).toBe(0)
    expect(sample.phases.tail.sse.events).toBeGreaterThan(0)
    for (const [name, phase] of Object.entries(sample.phases) as Array<[string, { wallMs: number, memory: { after: { rss: number } }, http: { samples: number }, sse: { revision: number }, revision: number }]>) {
      expect(Number.isFinite(phase.wallMs)).toBe(true)
      expect(phase.memory.after.rss).toBeGreaterThan(0)
      if (name !== 'bootstrap') {
        expect(phase.http.samples).toBeGreaterThan(0)
        expect(phase.sse.revision).toBe(phase.revision)
      }
    }
  }
}, 30_000)

test('invalid diagnostic bounds fail before creating an application or workload', async () => {
  await expect(run(process.execPath, ['--import', 'tsx', script, '--large=not-a-number'])).rejects.toMatchObject({ code: 1 })
})

test('worker cleanup errors disconnect IPC and fail the diagnostic rather than wait for its kill timer', async () => {
  const preload = new URL('./fixtures/journal-profile-stop-failure.mjs', import.meta.url).href
  await expect(run(process.execPath, ['--import', 'tsx', '--import', preload, script, '--small=8', '--large=32', '--repeats=1'], { timeout: 25_000 }))
    .rejects.toMatchObject({ code: 1, killed: false, stderr: expect.stringContaining('Fixture cleanup failure') })
}, 30_000)

test('diagnostic waits for delayed parent-side SSE delivery, independently of ingestion wall time', async () => {
  const preload = new URL('./fixtures/journal-profile-delayed-stream.mjs', import.meta.url).href
  const { stdout } = await run(process.execPath, ['--import', 'tsx', '--import', preload, script, '--small=8', '--large=32', '--repeats=1'], { timeout: 25_000 })
  for (const sample of JSON.parse(stdout).results) {
    expect(sample.phases.tail.sse.events).toBeGreaterThan(0)
    expect(sample.phases.tail.sse.revision).toBe(sample.phases.tail.revision)
  }
}, 30_000)
