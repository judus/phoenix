import { expect, test } from 'vitest'
import { RecordingKeyboardOutput } from 'control-deck/adapter-keyboard'
import { PhoenixApplication } from '../apps/server/src/phoenix-application.js'
import { PhoenixApiClient } from '../apps/web/src/platform/api/phoenix-api-client.js'
import { parsePhoenixRoute } from '../apps/web/src/application/navigation/phoenix-router.js'
import { StaticEliteDangerousBindings } from './support/static-elite-dangerous-bindings.js'

test('shortcut commands resolve saved IDs, refresh the catalogue and return local navigation only', async () => {
  const keyboard = new RecordingKeyboardOutput()
  const application = new PhoenixApplication({
    eliteBindings: new StaticEliteDangerousBindings(), databasePath: ':memory:', eliteDirectory: null,
    host: '127.0.0.1', keyboardOutput: keyboard, port: 0
  })
  const address = await application.start()
  const client = new PhoenixApiClient(`http://${address.host}:${address.port}`)
  try {
    const configuration = await client.getControlDeckConfiguration()
    expect(configuration.decks.find(deck => deck.context === 'phoenix:quick')!.elements).toHaveLength(5)
    const saved = await client.saveGalaxyQuery({ name: 'Nearest raw material trader',
      queryId: 'facilities', parameters: { originMode: 'current', origin: '', service: 'material-trader-raw', pad: 'medium' }, useOnDashboard: false })
    const bookmark = await client.saveGalaxyBookmark({ tags: [], note: null,
      target: { kind: 'station', systemName: 'Sol & Beyond', stationName: 'Station #1' } })
    const queryTarget = { type: 'navigation' as const, destinationId: `saved-query:${saved.id}` }
    const bookmarkTarget = { type: 'navigation' as const, destinationId: `bookmark:${bookmark.id}` }
    const commands = (await client.getControlDeckCommands()).adapters.flatMap(adapter => adapter.commands)
    expect(commands.find(command => command.id === `command.navigation.${queryTarget.destinationId}`)?.label).toBe(saved.name)
    expect(commands.find(command => command.id === `command.navigation.${bookmarkTarget.destinationId}`)?.category).toBe('Bookmarks')
    const first = await client.executeCommand(queryTarget)
    const second = await client.executeCommand(queryTarget)
    expect(first.status).toBe('accepted')
    expect(first.navigationHref).not.toBe(second.navigationHref)
    expect(parsePhoenixRoute(first.navigationHref!)).toMatchObject({ view: 'database', savedQueryId: saved.id, savedQueryRunId: expect.any(String) })
    expect(parsePhoenixRoute((await client.executeCommand(bookmarkTarget)).navigationHref!)).toMatchObject({
      view: 'system', systemName: 'Sol & Beyond', selectedName: 'Station #1'
    })
    await client.saveGalaxyQuery({ queryId: saved.queryId, parameters: saved.parameters, useOnDashboard: false, name: 'Renamed trader search' }, saved.id)
    expect((await client.getCommands()).commands.find(command => command.id === `command.navigation.${queryTarget.destinationId}`)?.label).toBe('Renamed trader search')
    await client.saveGalaxyBookmark({ tags: [], note: null, target: { kind: 'body', systemName: 'Sol', bodyName: 'Sol A 1' } }, bookmark.id)
    expect(parsePhoenixRoute((await client.executeCommand(bookmarkTarget)).navigationHref!)).toMatchObject({ selectedName: 'Sol A 1' })
    await client.deleteGalaxyQuery(saved.id)
    await client.deleteGalaxyBookmark(bookmark.id)
    expect((await client.executeCommand(queryTarget)).status).toBe('rejected')
    expect((await client.executeCommand(bookmarkTarget)).status).toBe('rejected')
    expect(keyboard.getRecordedInputs()).toEqual([])
  } finally { await application.stop() }
})
