import { copyFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from 'vitest'
import { PhoenixApplication } from '../apps/server/src/phoenix-application.js'
import { PhoenixApiClient } from '../apps/web/src/api/phoenix-api-client.js'

const fixturePath = fileURLToPath(
  new URL('./fixtures/elite/Journal.2026-08-10T120000.01.log', import.meta.url)
)

test('application startup projects the current commander, ranks, location and ship from the journal', async () => {
  const eliteDirectory = mkdtempSync(join(tmpdir(), 'phoenix-journal-integration-'))
  copyFileSync(fixturePath, join(eliteDirectory, basename(fixturePath)))
  const application = new PhoenixApplication({
    databasePath: ':memory:',
    eliteDirectory,
    host: '127.0.0.1',
    port: 0
  })

  try {
    const address = await application.start()
    const client = new PhoenixApiClient(`http://${address.host}:${address.port}`)
    const state = await client.getRuntimeState()
    const diagnostics = await client.getEliteJournalDiagnostics()

    expect(state).toMatchObject({
      revision: 5,
      commander: {
        name: 'Test Commander',
        ranks: { combat: 5, trade: 8, exploration: 6, exobiologist: 4 },
        rankProgress: { combat: 42, exploration: 73, exobiologist: 91 }
      },
      location: {
        state: 'docked',
        systemName: 'Sol',
        placeName: 'Galileo'
      },
      ship: {
        type: 'cobramkiii',
        name: 'Wayward Sun'
      },
      gameStatus: null
    })
    expect(diagnostics).toMatchObject({
      directory: eliteDirectory,
      watching: true,
      fileAvailable: true,
      linesRead: 6,
      error: null
    })
  } finally {
    await application.stop()
    rmSync(eliteDirectory, { recursive: true, force: true })
  }
})
