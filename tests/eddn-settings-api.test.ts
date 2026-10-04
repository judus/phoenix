import { expect, test } from 'vitest'
import { PhoenixApplication } from '../apps/server/src/phoenix-application.js'
import { PhoenixApiClient } from '../apps/web/src/platform/api/phoenix-api-client.js'

test('settings API defaults on, persists off and rejects invalid input', async () => {
  const application = new PhoenixApplication({ databasePath: ':memory:', eliteDirectory: null, host: '127.0.0.1', port: 0, copilot: null, copilotRealtime: null })
  const address = await application.start()
  const origin = `http://${address.host}:${address.port}`
  const client = new PhoenixApiClient(origin)
  try {
    expect(await client.getEddnStatus()).toMatchObject({ enabled: true, mode: 'unavailable', queued: 0 })
    expect(await client.saveEddnSettings({ enabled: false })).toMatchObject({ enabled: false, queued: 0 })
    expect(await client.getEddnStatus()).toMatchObject({ enabled: false })
    expect((await fetch(`${origin}/api/settings/eddn`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: '{"enabled":"yes"}' })).status).toBe(400)
    expect(await client.getEddnStatus()).toMatchObject({ enabled: false })
  } finally { await application.stop() }
})
