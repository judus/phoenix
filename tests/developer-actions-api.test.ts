import { expect, test } from 'vitest'
import { PhoenixApplication } from '../apps/server/src/phoenix-application.js'
import { PhoenixApiClient } from '../apps/web/src/api/phoenix-api-client.js'

test('the developer API exposes and safely simulates the action catalogue', async () => {
  const application = new PhoenixApplication({
    databasePath: ':memory:',
    host: '127.0.0.1',
    port: 0
  })
  const address = await application.start()

  try {
    const client = new PhoenixApiClient(`http://${address.host}:${address.port}`)
    const catalog = await client.getDeveloperActions()
    const lights = catalog.actions.find(action => action.definition.id === 'ship.lights.toggle')

    expect(catalog.backend).toMatchObject({ available: true, id: 'recording', simulated: true })
    expect(lights).toMatchObject({ available: true, binding: { display: 'L' } })

    const result = await client.executeDeveloperAction('ship.lights.toggle')
    expect(result).toMatchObject({
      actionId: 'ship.lights.toggle',
      origin: 'developer',
      status: 'accepted'
    })
    expect(result.message).toContain('no operating-system input was sent')
  } finally {
    await application.stop()
  }
})
