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
      revision: 6,
      commander: {
        name: 'Test Commander',
        ranks: { combat: 5, trade: 8, exploration: 6, exobiologist: 4 },
        rankProgress: { combat: 42, exploration: 73, exobiologist: 91 }
      },
      system: {
        name: 'Sol',
        address: 10477373803,
        position: [0, 0, 0],
        allegiance: 'Federation',
        primaryEconomy: { id: '$economy_HighTech;', label: 'High Tech' },
        secondaryEconomy: { id: '$economy_Industrial;', label: 'Industrial' },
        security: { label: 'High Security' },
        population: 22000000000,
        controllingFaction: { name: 'Mother Gaia', state: 'Boom' },
        factions: [{ name: 'Mother Gaia', influence: 0.6 }]
      },
      location: {
        state: 'docked',
        place: {
          kind: 'station',
          name: 'Galileo',
          type: 'Orbis',
          marketId: 128666762,
          faction: { name: 'Mother Gaia', state: 'Boom' },
          primaryEconomy: { label: 'High Tech' },
          economies: [
            { economy: { label: 'High Tech' }, proportion: 0.8 },
            { economy: { label: 'Industrial' }, proportion: 0.2 }
          ],
          services: ['dock', 'commodities', 'outfitting', 'shipyard']
        }
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
