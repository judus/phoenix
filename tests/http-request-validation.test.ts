import { expect, test } from 'vitest'
import { PhoenixApplication } from '../apps/server/src/phoenix-application.js'

test('invalid galaxy query parameters are reported as client errors', async () => {
  const application = new PhoenixApplication({
    databasePath: ':memory:',
    eliteDirectory: null,
    host: '127.0.0.1',
    port: 0
  })
  const address = await application.start()

  try {
    const missing = await fetch(`http://${address.host}:${address.port}/api/galaxy/systems`)
    expect(missing.status).toBe(400)
    await expect(missing.json()).resolves.toEqual({
      error: { code: 'invalid_request', message: 'system is required.' }
    })

    const invalid = await fetch(`http://${address.host}:${address.port}/api/galaxy/systems/search?system=Sol&population=unknown`)
    expect(invalid.status).toBe(400)
    await expect(invalid.json()).resolves.toEqual({
      error: { code: 'invalid_request', message: 'population must be one of any, inhabited, uninhabited.' }
    })

    const partialInteger = await fetch(`http://${address.host}:${address.port}/api/galaxy/systems?system=Sol&limit=20items`)
    expect(partialInteger.status).toBe(400)
    await expect(partialInteger.json()).resolves.toEqual({
      error: { code: 'invalid_request', message: 'limit must be an integer.' }
    })
  } finally {
    await application.stop()
  }
})
