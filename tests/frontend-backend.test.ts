import { expect, test } from 'vitest'
import { PHOENIX_API_VERSION } from '@phoenix/contracts'
import { PhoenixApplication } from '../apps/server/src/phoenix-application.js'
import { PhoenixApiClient } from '../apps/web/src/api/phoenix-api-client.js'

test('the frontend API client communicates with the PHOENIX backend', async () => {
  const application = new PhoenixApplication({
    databasePath: ':memory:',
    eliteDirectory: null,
    host: '127.0.0.1',
    port: 0
  })
  const address = await application.start()

  try {
    const client = new PhoenixApiClient(`http://${address.host}:${address.port}`)
    const health = await client.getHealth()

    expect(health.status).toBe('ok')
    expect(health.apiVersion).toBe(PHOENIX_API_VERSION)
    expect(health.database).toEqual({ connected: true, engine: 'sqlite' })
  } finally {
    await application.stop()
  }
})
