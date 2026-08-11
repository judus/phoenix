import { expect, test } from 'vitest'
import { createEmptyRuntimeState, type CartographicSystem, type DisplayCommand } from '@phoenix/contracts'
import { DisplayCommandService } from '../apps/server/src/application/display-command-service.js'
import type { CartographySource } from '../apps/server/src/domain/cartography.js'
import { InMemoryRuntimeStateStore } from '../apps/server/src/infrastructure/in-memory-runtime-state-store.js'
import { InProcessPublisher } from '../apps/server/src/infrastructure/in-process-publisher.js'
import { PhoenixApplication } from '../apps/server/src/phoenix-application.js'
import { PhoenixApiClient } from '../apps/web/src/api/phoenix-api-client.js'

test('navigation API exposes lossless system cartography and the current plotted route', async () => {
  const source: CartographySource = { fetchSystem: async systemName => fixtureSystem(systemName) }
  const application = new PhoenixApplication({
    cartographySource: source,
    databasePath: ':memory:',
    eliteDirectory: null,
    host: '127.0.0.1',
    port: 0
  })
  const address = await application.start()
  const api = new PhoenixApiClient(`http://${address.host}:${address.port}`)

  try {
    const system = await api.getSystemCartography('Sol')
    expect(system).toMatchObject({
      cache: 'refreshed',
      system: { name: 'Sol', raw: { system: { providerSpecific: 'retained' } } }
    })
    await expect(api.getNavigationRoute()).resolves.toEqual({ timestamp: null, route: [] })
  } finally {
    await application.stop()
  }
})

test('display commands resolve current context and publish a browser-neutral instruction', () => {
  const runtime = new InMemoryRuntimeStateStore()
  const state = createEmptyRuntimeState()
  runtime.replace({ ...state, system: { ...state.system, name: 'Sol' } })
  const publisher = new InProcessPublisher<DisplayCommand>()
  const display = new DisplayCommandService(
    publisher,
    runtime,
    () => new Date('2026-08-11T20:00:00.000Z')
  )
  const commands: DisplayCommand[] = []
  publisher.subscribe(command => commands.push(command))

  const result = display.showBody({ bodyName: 'Earth' })

  expect(result.structuredContent).toEqual({ bodyName: 'Earth', displayed: true, systemName: 'Sol' })
  expect(commands).toEqual([expect.objectContaining({
    type: 'show_body',
    systemName: 'Sol',
    selectedName: 'Earth',
    createdAt: '2026-08-11T20:00:00.000Z'
  })])
})

function fixtureSystem (name: string): CartographicSystem {
  return {
    schemaVersion: 1,
    name,
    address: 10477373803,
    position: [0, 0, 0],
    permitRequired: null,
    permitName: null,
    information: {
      allegiance: 'Federation',
      government: 'Democracy',
      security: 'High',
      state: null,
      primaryEconomy: 'Service',
      secondaryEconomy: null,
      population: 23_000_000_000,
      controllingFaction: null
    },
    primaryStar: null,
    bodies: [],
    stations: [],
    scanProgress: { knownBodies: 0, reportedBodies: null, percent: null },
    localSystem: null,
    source: { provider: 'edsm', fetchedAt: '2026-08-11T20:00:00.000Z' },
    raw: {
      system: { providerSpecific: 'retained' },
      bodies: { bodies: [] },
      stations: { stations: [] }
    }
  }
}
