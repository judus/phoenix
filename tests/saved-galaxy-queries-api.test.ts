import { expect, test } from 'vitest'
import { RecordingKeyboardOutput } from 'control-deck/adapter-keyboard'
import { PhoenixApplication } from '../apps/server/src/phoenix-application.js'
import { PhoenixApiClient } from '../apps/web/src/platform/api/phoenix-api-client.js'
import { StaticEliteDangerousBindings } from './support/static-elite-dangerous-bindings.js'

test('the saved Galaxy query API creates, updates, lists, and removes definitions', async () => {
  const application = new PhoenixApplication({
    eliteBindings: new StaticEliteDangerousBindings(),
    databasePath: ':memory:',
    eliteDirectory: null,
    host: '127.0.0.1',
    keyboardOutput: new RecordingKeyboardOutput(),
    port: 0
  })
  const address = await application.start()
  const client = new PhoenixApiClient(`http://${address.host}:${address.port}`)

  try {
    const created = await client.saveGalaxyQuery({
      name: 'Nearby high-tech systems',
      parameters: { economy: 'High Tech', origin: 'Sol', radius: '100' },
      queryId: 'system-search',
      useOnDashboard: false
    })
    const updated = await client.saveGalaxyQuery({
      name: 'Nearby industrial systems',
      parameters: { economy: 'Industrial', origin: 'Sol', radius: '100' },
      queryId: 'system-search',
      useOnDashboard: false
    }, created.id)

    expect(updated).toMatchObject({ id: created.id, name: 'Nearby industrial systems', schemaVersion: 2, useOnDashboard: false })
    await expect(client.getSavedGalaxyQueries()).resolves.toEqual({ queries: [updated] })

    await client.deleteGalaxyQuery(created.id)
    await expect(client.getSavedGalaxyQueries()).resolves.toEqual({ queries: [] })
  } finally {
    await application.stop()
  }
})
