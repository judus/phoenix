import { expect, test } from 'vitest'
import {
  EliteInventorySourceDiagnosticsSchema,
  EliteNavigationRouteSourceDiagnosticsSchema
} from '@phoenix/contracts'
import { PhoenixApplication } from '../apps/server/src/phoenix-application.js'

test('developer endpoints expose inventory and route source diagnostics', async () => {
  const application = new PhoenixApplication({
    databasePath: ':memory:',
    eliteDirectory: null,
    host: '127.0.0.1',
    port: 0
  })
  const address = await application.start()
  const baseUrl = `http://${address.host}:${address.port}`

  try {
    const inventory = await fetch(`${baseUrl}/api/developer/elite-inventory`)
    expect(inventory.status).toBe(200)
    expect(EliteInventorySourceDiagnosticsSchema.parse(await inventory.json())).toMatchObject({
      error: 'Elite Dangerous data directory was not found.',
      files: [],
      watching: false
    })

    const route = await fetch(`${baseUrl}/api/developer/elite-navigation-route`)
    expect(route.status).toBe(200)
    expect(EliteNavigationRouteSourceDiagnosticsSchema.parse(await route.json())).toMatchObject({
      error: 'Elite Dangerous data directory was not found.',
      fileAvailable: false,
      filePath: null,
      watching: false
    })
  } finally {
    await application.stop()
  }
})
