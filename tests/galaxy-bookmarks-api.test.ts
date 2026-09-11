import { expect, test } from 'vitest'
import { RecordingKeyboardOutput } from 'control-deck/adapter-keyboard'
import { PhoenixApplication } from '../apps/server/src/phoenix-application.js'
import { PhoenixApiClient } from '../apps/web/src/platform/api/phoenix-api-client.js'
import { StaticEliteDangerousBindings } from './support/static-elite-dangerous-bindings.js'

test('the Galaxy bookmark API creates, updates, lists, and removes bookmarks', async () => {
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
    const created = await client.saveGalaxyBookmark({
      note: 'Return for biology.',
      tags: ['Exploration'],
      target: { kind: 'system', systemName: 'Smoje TO-Z d13-40' }
    })
    const updated = await client.saveGalaxyBookmark({
      note: 'Return after refitting.',
      tags: ['Exploration', 'Refit'],
      target: created.target
    }, created.id)

    expect(updated).toMatchObject({ id: created.id, note: 'Return after refitting.' })
    await expect(client.getGalaxyBookmarks()).resolves.toMatchObject({ bookmarks: [updated] })

    await client.deleteGalaxyBookmark(created.id)
    await expect(client.getGalaxyBookmarks()).resolves.toEqual({ bookmarks: [] })
  } finally {
    await application.stop()
  }
})
