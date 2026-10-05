import { expect, test } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { SqliteDatabase } from '../apps/server/src/infrastructure/sqlite-database.js'
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
    const initial = await client.getSavedGalaxyQueries()
    expect(initial.queries).toHaveLength(1)
    expect(initial.queries[0]).toMatchObject({ name: 'Pre-Odyssey Stratum candidates', parameters: { origin: '', originMode: 'current' } })
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
    expect((await client.getSavedGalaxyQueries()).queries).toEqual(expect.arrayContaining([updated, ...initial.queries]))

    await client.deleteGalaxyQuery(created.id)
    await expect(client.getSavedGalaxyQueries()).resolves.toEqual(initial)
    const predefined = initial.queries[0]!
    const edited = await client.saveGalaxyQuery({ name: 'My Stratum query', parameters: predefined.parameters, queryId: predefined.queryId, useOnDashboard: false }, predefined.id)
    await expect(client.importPredefinedGalaxyQueries()).resolves.toEqual({ queries: [edited] })
    await client.deleteGalaxyQuery(predefined.id)
    expect((await client.importPredefinedGalaxyQueries()).queries).toHaveLength(1)
  } finally {
    await application.stop()
  }
})

test('existing profiles opt in; application restarts do not resurrect deleted predefined queries', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'phoenix-saved-query-api-'))
  const databasePath = join(directory, 'profile.sqlite')
  const database = new SqliteDatabase(databasePath)
  database.initialize()
  database.close()
  const start = async () => {
    const application = new PhoenixApplication({ eliteBindings: new StaticEliteDangerousBindings(), databasePath, eliteDirectory: null, host: '127.0.0.1', keyboardOutput: new RecordingKeyboardOutput(), port: 0 })
    const address = await application.start()
    return { application, client: new PhoenixApiClient(`http://${address.host}:${address.port}`) }
  }
  let session = await start()
  try {
    await expect(session.client.getSavedGalaxyQueries()).resolves.toEqual({ queries: [] })
    const imported = await session.client.importPredefinedGalaxyQueries()
    expect(imported.queries).toHaveLength(1)
    await session.client.deleteGalaxyQuery(imported.queries[0]!.id)
    await session.application.stop()
    session = await start()
    await expect(session.client.getSavedGalaxyQueries()).resolves.toEqual({ queries: [] })
  } finally {
    await session.application.stop()
    rmSync(directory, { recursive: true, force: true })
  }
})
