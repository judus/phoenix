import { fork } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync, appendFileSync } from 'node:fs'
import { tmpdir, cpus } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

export function journalRecords(count, offset = 0) {
  return Array.from({ length: count }, (_, index) => {
    const id = index + offset
    const timestamp = new Date(Date.UTC(2026, 0, 1) + id * 1000).toISOString()
    const event = id % 250 === 0
      ? { event: 'FSDJump', StarSystem: `Synthetic ${id / 250}`, SystemAddress: id + 1, StarPos: [id, 0, 0], JumpDist: 10 }
      : id % 4 === 0 ? { event: 'Progress', Combat: id % 100 }
        : id % 4 === 2 ? { event: 'ReceiveText', From: 'Synthetic', Message: `Fixture ${id}`, Channel: 'npc' }
          : { event: 'FuelScoop', Scooped: 1, Total: 10 }
    return JSON.stringify({ timestamp, ...event }) + '\n'
  }).join('')
}

function option(name, fallback) {
  const argument = process.argv.slice(2).find(value => value.startsWith(`--${name}=`))
  if (!argument) return fallback
  const value = Number(argument.slice(name.length + 3))
  if (!Number.isSafeInteger(value) || value < 1 || value > 100_000) throw new Error(`--${name} must be an integer from 1 to 100000.`)
  return value
}

async function profile(count) {
  const directory = mkdtempSync(join(tmpdir(), 'phoenix-journal-profile-'))
  const latest = join(directory, 'Journal.2026-01-02T000000.01.log')
  const initial = journalRecords(count)
  const tail = journalRecords(count, count)
  const reset = journalRecords(Math.max(1, Math.floor(count / 10)), count * 2)
  const historical = journalRecords(count, count * 3)
  writeFileSync(latest, initial)
  const child = fork(new URL('./journal-profile-worker.mjs', import.meta.url), [directory], { stdio: ['ignore', 'ignore', 'inherit', 'ipc'] })
  const exit = new Promise(resolve => child.once('exit', resolve))
  const replies = new Map()
  let ready
  const readiness = new Promise(resolve => { ready = resolve })
  child.on('message', message => {
    if (message.type === 'ready') ready()
    else if (message.type === 'result') {
      const pending = replies.get(message.id)
      replies.delete(message.id)
      if (message.error) pending?.reject(new Error(message.error))
      else pending?.resolve(message)
    }
  })
  child.on('exit', code => {
    for (const pending of replies.values()) pending.reject(new Error(`Diagnostic worker exited (${code}).`))
    replies.clear()
  })
  let id = 0
  const request = operation => new Promise((resolve, reject) => {
    const key = ++id
    replies.set(key, { resolve, reject })
    child.send({ id: key, operation })
  })
  const timeout = setTimeout(() => child.kill(), 120_000)
  let streamController, streamTask, streamError
  let streamRevision = -1, streamCount = 0, streamPhase
  try {
    await Promise.race([readiness, exit.then(() => { throw new Error('Worker exited before readiness.') })])
    const bootstrap = await request('bootstrap')
    const origin = `http://127.0.0.1:${bootstrap.port}`
    streamController = new AbortController()
    const stream = await fetch(`${origin}/api/runtime-state/stream`, { signal: streamController.signal })
    if (!stream.ok || !stream.body) throw new Error('Runtime stream did not open.')
    let initialEvent
    const first = new Promise(resolve => { initialEvent = resolve })
    streamTask = (async () => {
      let buffer = ''
      const decoder = new TextDecoder()
      for await (const chunk of stream.body) {
        buffer += decoder.decode(chunk, { stream: true }).replace(/\r\n/g, '\n')
        let end
        while ((end = buffer.indexOf('\n\n')) >= 0) {
          const frame = buffer.slice(0, end)
          buffer = buffer.slice(end + 2)
          if (!frame.includes('event: runtime-state')) continue
          const data = frame.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trim()).join('\n')
          streamRevision = JSON.parse(data).revision
          streamCount++
          const now = performance.now()
          if (streamPhase) {
            streamPhase.maxGapMs = Math.max(streamPhase.maxGapMs, now - streamPhase.lastAt)
            streamPhase.lastAt = now
          }
          initialEvent()
        }
      }
    })().catch(error => { if (!streamController.signal.aborted) streamError = error })
    await Promise.race([first, streamTask.then(() => { throw streamError ?? new Error('Runtime stream closed before its initial event.') })])

    async function phase(operation, mutate) {
      const latencies = []
      let probing = true
      let probeError
      const beforeEvents = streamCount
      streamPhase = { maxGapMs: 0, lastAt: performance.now() }
      // Probes run in this separate process; their clocks keep running if ingestion starves Node.
      const probes = (async () => {
        while (probing) {
          const started = performance.now()
          const response = await fetch(`${origin}/api/runtime-state`, { signal: AbortSignal.timeout(15_000) })
          if (!response.ok) throw new Error(`HTTP probe failed (${response.status}).`)
          await response.json()
          latencies.push(performance.now() - started)
          await new Promise(resolve => setTimeout(resolve, 10))
        }
      })().catch(error => { probeError = error; probing = false })
      try {
        mutate?.()
        const result = await request(operation)
        probing = false
        await probes
        if (probeError) throw probeError
        if (streamError) throw streamError
        if (streamRevision !== result.revision) throw new Error(`SSE revision ${streamRevision} differs from server ${result.revision}.`)
        const sorted = latencies.sort((a, b) => a - b)
        return { ...result, http: { samples: sorted.length, p95Ms: sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)], maxMs: sorted.at(-1) },
          sse: { events: streamCount - beforeEvents, revision: streamRevision, maxDeliveryGapMs: streamPhase.maxGapMs } }
      } finally { probing = false; await probes; streamPhase = undefined }
    }
    const idle = await phase('idle')
    const appended = await phase('tail', () => appendFileSync(latest, tail))
    const truncated = await phase('reset', () => writeFileSync(latest, reset))
    const history = await phase('history', () => writeFileSync(join(directory, 'Journal.2026-01-01T000000.01.log'), historical))
    const checkpoint = await phase('history')
    for (const [result, expected] of [[bootstrap, count], [appended, count], [truncated, Math.max(1, Math.floor(count / 10))]]) {
      if (result.linesProcessed !== expected) throw new Error(`${result.operation} processed ${result.linesProcessed}, expected ${expected}.`)
    }
    if (history.history.linesProcessed !== count || checkpoint.history.linesProcessed !== 0) throw new Error('Historical records/checkpoint replay did not match the fixture.')
    return { lines: count, bytes: { bootstrap: Buffer.byteLength(initial), tail: Buffer.byteLength(tail), reset: Buffer.byteLength(reset), history: Buffer.byteLength(historical) },
      phases: { bootstrap, idle, tail: appended, reset: truncated, history, checkpoint } }
  } finally {
    streamController?.abort()
    await streamTask
    if (child.connected) await request('stop').catch(() => {})
    await exit
    clearTimeout(timeout)
    rmSync(directory, { recursive: true, force: true })
  }
}

export async function main() {
  const small = option('small', 200), large = option('large', 20_000), repeats = option('repeats', 3)
  if (large <= small || repeats > 10) throw new Error('Use large > small and repeats <= 10.')
  const results = []
  for (let repeat = 0; repeat < repeats; repeat++) for (const count of [small, large]) results.push({ repeat: repeat + 1, ...await profile(count) })
  console.log(JSON.stringify({ environment: { node: process.version, platform: process.platform, arch: process.arch, cpu: cpus()[0]?.model },
    workload: 'Every 250th record FSDJump; remaining records 25% Progress, 25% ReceiveText, 50% FuelScoop. Synthetic only; in-memory SQLite; external fetch rejected; EDDN disabled.', results }, null, 2))
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main()
