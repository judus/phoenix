import { expect, test } from 'vitest'
import { PhoenixApplication } from '../apps/server/src/phoenix-application.js'
import { PhoenixApiClient } from '../apps/web/src/api/phoenix-api-client.js'
import { StaticGameActionBindingResolver } from '../apps/server/src/infrastructure/static-game-action-binding-resolver.js'
import { RecordingInputBackend } from '../apps/server/src/infrastructure/recording-input-backend.js'

test('the developer API exposes and safely simulates the action catalogue', async () => {
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
  } finally {
    await application.stop()
  }
})
