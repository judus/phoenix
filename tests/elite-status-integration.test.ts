import { cpSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from 'vitest'
import { PhoenixApplication } from '../apps/server/src/phoenix-application.js'
import { PhoenixApiClient } from '../apps/web/src/api/phoenix-api-client.js'

const fixturePath = fileURLToPath(new URL('./fixtures/elite/status-docked.json', import.meta.url))

test('application startup ingests Status.json into the live runtime snapshot', async () => {
  const eliteDirectory = mkdtempSync(join(tmpdir(), 'phoenix-elite-integration-'))
  cpSync(fixturePath, join(eliteDirectory, 'Status.json'))
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
    const diagnostics = await client.getEliteStatusDiagnostics()

    expect(state).toMatchObject({
      revision: 1,
      location: { state: 'docked' },
      gameStatus: {
        flags: { lightsOn: true, docked: true },
        cargo: 96
      }
    })
    expect(diagnostics).toMatchObject({
      directory: eliteDirectory,
      watching: true,
      fileAvailable: true,
      error: null
    })
  } finally {
    await application.stop()
    rmSync(eliteDirectory, { recursive: true, force: true })
  }
})
