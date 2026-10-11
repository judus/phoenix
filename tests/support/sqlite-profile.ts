import { performance } from 'node:perf_hooks'
import { DatabaseSync, StatementSync } from 'node:sqlite'
import { afterAll, afterEach, beforeEach } from 'vitest'

// Opt-in diagnostic only: retain normal SQLite durability, isolation and test timeouts.
let started = 0
let elapsed = 0
let calls = 0
let slowest: { operation: string, ms: number }[] = []
const restore: Array<() => void> = []

function instrument(prototype: object, method: string): void {
  const descriptor = Object.getOwnPropertyDescriptor(prototype, method)!
  restore.push(() => { Object.defineProperty(prototype, method, descriptor) })
  const original = descriptor.value as (...args: unknown[]) => unknown
  Object.defineProperty(prototype, method, { ...descriptor, value: function (this: unknown, ...args: unknown[]) {
    const start = performance.now()
    try { return original.apply(this, args) }
    finally {
      const ms = performance.now() - start
      elapsed += ms
      calls++
      // Report operation names, never SQL, bound values, paths or stored documents.
      const operation = method === 'exec' ? `exec:${String(args[0]).trim().split(/\s+/)[0]!.toUpperCase()}` : method
      slowest.push({ operation, ms })
      slowest.sort((a, b) => b.ms - a.ms)
      slowest.length = Math.min(slowest.length, 5)
    }
  } })
}

for (const method of ['exec', 'prepare', 'close']) instrument(DatabaseSync.prototype, method)
for (const method of ['run', 'get', 'all']) instrument(StatementSync.prototype, method)
afterAll(() => { for (const undo of restore.reverse()) undo() })

beforeEach(() => { started = performance.now(); elapsed = 0; calls = 0; slowest = [] })
afterEach(context => {
  if (!calls) return
  console.info('SQLITE_PROFILE', JSON.stringify({
    test: context.task.name, wallMs: Math.round(performance.now() - started),
    sqliteMs: Math.round(elapsed), calls,
    slowest: slowest.map(entry => ({ ...entry, ms: Math.round(entry.ms) }))
  }))
})
