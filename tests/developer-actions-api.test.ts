import { expect, test } from 'vitest'
import { PhoenixApplication } from '../apps/server/src/phoenix-application.js'
import { PhoenixApiClient } from '../apps/web/src/api/phoenix-api-client.js'
import { StaticGameActionBindingResolver } from '../apps/server/src/infrastructure/static-game-action-binding-resolver.js'
import { RecordingInputBackend } from '../apps/server/src/infrastructure/recording-input-backend.js'

test('the API exposes actions, executes them, and persists the shared control layout', async () => {
  const inputBackend = new RecordingInputBackend()
  const application = new PhoenixApplication({
    actionBindingResolver: new StaticGameActionBindingResolver(),
    databasePath: ':memory:',
    eliteDirectory: null,
    host: '127.0.0.1',
    inputBackend,
    port: 0
  })
  const address = await application.start()

  try {
    const client = new PhoenixApiClient(`http://${address.host}:${address.port}`)
    const catalog = await client.getDeveloperActions()
    const lights = catalog.actions.find(action => action.definition.id === 'elite.ShipSpotLightToggle')

    expect(catalog.backend).toMatchObject({ available: true, id: 'recording', simulated: true })
    expect(lights).toMatchObject({ available: true, binding: { display: 'L' } })

    const result = await client.executeDeveloperAction('elite.ShipSpotLightToggle')
    expect(result).toMatchObject({
      actionId: 'elite.ShipSpotLightToggle',
      origin: 'developer',
      status: 'accepted'
    })
    expect(result.message).toContain('no operating-system input was sent')

    const pressed = await client.executeAction('elite.PrimaryFire', 'press')
    const released = await client.executeAction('elite.PrimaryFire', 'release')
    expect(pressed).toMatchObject({ origin: 'ui', operation: 'press', status: 'accepted' })
    expect(released).toMatchObject({ origin: 'ui', operation: 'release', status: 'accepted' })
    expect(inputBackend.getRecordedInputs().slice(-2)).toEqual([
      { operation: 'press', binding: { key: 'Space', modifiers: [], display: 'Space' } },
      { operation: 'release', binding: { key: 'Space', modifiers: [], display: 'Space' } }
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

    const commandResult = await client.executeCommand({
      type: 'game-action',
      actionId: 'elite.ShipSpotLightToggle'
    })
    expect(commandResult).toMatchObject({
      commandId: 'command.elite.ShipSpotLightToggle',
      status: 'accepted',
      target: { type: 'game-action', actionId: 'elite.ShipSpotLightToggle' }
    })

    const navigationResult = await client.executeCommand({
      type: 'navigation',
      destinationId: 'galaxy.current-system'
    })
    expect(navigationResult).toMatchObject({
      navigationHref: '#/galaxy/system',
      status: 'accepted'
    })

    const initialLayout = await client.getControlLayout()
    const shipPage = initialLayout.pages.find(page => page.id === 'ship')
    expect(shipPage).toMatchObject({ columns: 8, rows: 5 })

    const movedLayout = {
      ...initialLayout,
      pages: initialLayout.pages.map(page => page.id !== 'ship'
        ? page
        : {
            ...page,
            cells: [
              ...page.cells.map(cell => cell.position === 1 ? { ...cell, target: null } : cell),
              { position: 2, span: 1, target: { type: 'game-action' as const, actionId: 'elite.GalaxyMapOpen' } }
            ]
          })
    }
    const savedLayout = await client.saveControlLayout(movedLayout)
    expect(savedLayout.pages.find(page => page.id === 'ship')?.cells).toContainEqual({
      position: 2,
      span: 1,
      target: { type: 'game-action', actionId: 'elite.GalaxyMapOpen' }
    })
    expect(await client.getControlLayout()).toEqual(savedLayout)
  } finally {
    await application.stop()
  }
})
