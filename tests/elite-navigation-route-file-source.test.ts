import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { EliteNavigationRouteFileSource } from '@phoenix/elite'

test('route diagnostics retain projection failures until the route is handled', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'phoenix-route-source-'))
  const file = join(directory, 'NavRoute.json')
  writeFileSync(file, JSON.stringify({
    timestamp: '2026-08-10T12:00:00Z',
    Route: [{ StarSystem: 'Sol', SystemAddress: 10477373803, StarPos: [0, 0, 0], StarClass: 'G' }]
  }))
  let fail = true
  const source = new EliteNavigationRouteFileSource(directory, () => {
    if (fail) throw new Error('Route projection unavailable.')
  }, { pollInterval: 60_000, retryCount: 1 })

  try {
    await source.start()
    expect(source.getDiagnostics()).toMatchObject({
      error: 'Route projection unavailable.',
      fileAvailable: true,
      filePath: file,
      lastReadAt: null,
      watching: true
    })

    fail = false
    expect(await source.refresh()).toBe(true)
    expect(source.getDiagnostics()).toMatchObject({
      error: null,
      fileAvailable: true,
      lastReadAt: expect.any(String)
    })
  } finally {
    source.stop()
    rmSync(directory, { recursive: true, force: true })
  }
})
