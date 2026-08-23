import { expect, test } from 'vitest'
import { CommandExecutionResultSchema, type CommandTarget } from '@phoenix/contracts'
import { PhoenixApplication } from '../apps/server/src/phoenix-application.js'
import { PhoenixApiClient } from '../apps/web/src/platform/api/phoenix-api-client.js'
import { StaticEliteDangerousBindings } from './support/static-elite-dangerous-bindings.js'
import { RecordingKeyboardOutput } from 'control-deck/adapter-keyboard'

test('the API exposes actions, executes them, and persists the shared control layout', async () => {
  const inputBackend = new RecordingKeyboardOutput()
  const application = new PhoenixApplication({
    eliteBindings: new StaticEliteDangerousBindings(),
    databasePath: ':memory:',
    eliteDirectory: null,
    host: '127.0.0.1',
    keyboardOutput: inputBackend,
    port: 0
  })
  const address = await application.start()
  const baseUrl = `http://${address.host}:${address.port}`

  try {
    const client = new PhoenixApiClient(baseUrl)
    const catalog = await client.getActions()
    const lights = catalog.actions.find(action => action.definition.id === 'elite.ShipSpotLightToggle')

    expect(catalog.backend).toMatchObject({ available: true, id: 'recording', simulated: true })
    expect(lights).toMatchObject({ available: true, binding: { display: 'L' } })

    const result = await client.executeAction('elite.ShipSpotLightToggle')
    expect(result).toMatchObject({
      actionId: 'elite.ShipSpotLightToggle',
      origin: 'ui',
      status: 'accepted'
    })
    expect(result.message).toContain('no operating-system input was sent')

    const lease = { leaseId: 'developer-api-pointer-1' }
    const pressed = await client.executeAction('elite.PrimaryFire', 'press', lease)
    const released = await client.executeAction('elite.PrimaryFire', 'release', lease)
    expect(pressed).toMatchObject({ origin: 'ui', operation: 'press', status: 'accepted' })
    expect(released).toMatchObject({ origin: 'ui', operation: 'release', status: 'accepted' })
    expect(inputBackend.getRecordedInputs().slice(-2)).toEqual([
      { operation: 'press', configuration: { key: 'Space', modifiers: [] } },
      { operation: 'release', configuration: { key: 'Space', modifiers: [] } }
    ])

    const commands = await client.getCommands()
    expect(commands.commands).toContainEqual(expect.objectContaining({
      id: 'command.elite.ShipSpotLightToggle',
      kind: 'game-action',
      target: { type: 'game-action', actionId: 'elite.ShipSpotLightToggle' }
    }))
    expect(commands.commands).toContainEqual(expect.objectContaining({
      id: 'command.navigation.galaxy.current-system',
      kind: 'navigation',
      target: { type: 'navigation', destinationId: 'galaxy.current-system' }
    }))

    const commandResult = await executeCommand(baseUrl, {
      type: 'game-action',
      actionId: 'elite.ShipSpotLightToggle'
    })
    expect(commandResult).toMatchObject({
      commandId: 'command.elite.ShipSpotLightToggle',
      status: 'accepted',
      target: { type: 'game-action', actionId: 'elite.ShipSpotLightToggle' }
    })

    const navigationResult = await executeCommand(baseUrl, {
      type: 'navigation',
      destinationId: 'galaxy.current-system'
    })
    expect(navigationResult).toMatchObject({
      navigationHref: '#/galaxy/system',
      status: 'accepted'
    })

    const initialConfiguration = await client.getControlDeckConfiguration()
    const shipDeck = initialConfiguration.decks.find(deck => deck.context === 'phoenix:ship')
    expect(shipDeck?.layout).toEqual({ kind: 'grid', columns: 8, rows: 5 })

    const movedConfiguration = {
      ...initialConfiguration,
      decks: initialConfiguration.decks.map(deck => deck.context !== 'phoenix:ship'
        ? deck
        : {
            ...deck,
            elements: deck.elements.map(element => element.id === 'cell_1'
              ? { ...element, placement: { ...element.placement, column: 2 } }
              : element)
          })
    }
    const savedConfiguration = await client.saveControlDeckConfiguration(movedConfiguration)
    expect(savedConfiguration.decks.find(deck => deck.context === 'phoenix:ship')?.elements)
      .toContainEqual(expect.objectContaining({ id: 'cell_1', placement: expect.objectContaining({ column: 2, row: 1 }) }))
    expect(await client.getControlDeckConfiguration()).toEqual(savedConfiguration)
  } finally {
    await application.stop()
  }
})

async function executeCommand (baseUrl: string, target: CommandTarget) {
  const response = await fetch(`${baseUrl}/api/commands/execute`, {
    body: JSON.stringify({ target, operation: 'tap' }),
    headers: { accept: 'application/json', 'content-type': 'application/json' },
    method: 'POST'
  })
  expect(response.ok).toBe(true)
  return CommandExecutionResultSchema.parse(await response.json())
}
