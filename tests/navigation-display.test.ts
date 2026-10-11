import { expect, test, vi } from 'vitest'
import { createEmptyRuntimeState, type CartographicSystem, type DisplayCommand } from '@phoenix/contracts'
import { DisplayCommandService } from '../apps/server/src/application/display-command-service.js'
import { DisplayAtlasService } from '../apps/server/src/application/display-atlas-service.js'
import { DisplayShowGalacticAtlasTool } from '../apps/server/src/application/mcp-tools/display-show-galactic-atlas-tool.js'
import { withToolErrorBoundary } from '../apps/server/src/application/mcp-tools/tool-error-boundary.js'
import { ProviderQueryError } from '../apps/server/src/domain/provider-query-error.js'
import { routeForDisplayCommand } from '../apps/web/src/application/navigation/display-page-routes.js'
import { parsePhoenixRoute, phoenixRouteHash } from '../apps/web/src/application/navigation/phoenix-router.js'
import { resolveDisplayPage } from '../apps/server/src/application/display-page-catalogue.js'
import type { ExternalCartographySource } from '../apps/server/src/domain/cartography.js'
import { InMemoryRuntimeStateStore } from '../apps/server/src/infrastructure/in-memory-runtime-state-store.js'
import { InProcessPublisher } from '../apps/server/src/infrastructure/in-process-publisher.js'
import { PhoenixApplication } from '../apps/server/src/phoenix-application.js'
import { PhoenixApiClient } from '../apps/web/src/platform/api/phoenix-api-client.js'

test('navigation API exposes lossless system cartography and the current plotted route', async () => {
  const source: ExternalCartographySource = { fetchSystem: async systemName => fixtureSystem(systemName) }
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

test.each([
  ['galactic atlas', 'galaxy.atlas'],
  ['atlas', 'galaxy.atlas'],
  ['exobiology', 'activities.exobiology'],
  ['exo', 'activities.exobiology'],
  ['plotted route', 'galaxy.route'],
  ['current route', 'galaxy.route'],
  ['show me the current route', 'galaxy.route'],
  ['open the personal stores page', 'commander.inventory'],
  ['loadouts', 'commander.loadouts'],
  ['gear', 'equipment.gear'],
  ['upgrade planner', 'equipment.planner'],
  ['suit upgrades', 'equipment.upgrades'],
  ['Odyssey engineers', 'equipment.specialists'],
  ['on-foot materials', 'equipment.materials'],
  ['please take me to GalNet Radio', 'comms.radio']
] as const)('display page catalogue resolves %s without exposing browser routes', (request, pageId) => {
  expect(resolveDisplayPage(request).id).toBe(pageId)
})

test('Atlas tool resolves canonical coordinates before publishing and defaults to current context', async () => {
  const runtime = new InMemoryRuntimeStateStore()
  const state = createEmptyRuntimeState()
  runtime.replace({ ...state, system: { ...state.system, name: 'Sol' } })
  const commands: DisplayCommand[] = []
  const publisher = new InProcessPublisher<DisplayCommand>()
  publisher.subscribe(command => commands.push(command))
  const getSystem = vi.fn(async (_name: string) => ({ cache: 'local' as const, system: fixtureSystem('Sol') }))
  const service = new DisplayAtlasService(publisher, { getSystem }, runtime)
  const result = await service.show({})
  expect(getSystem).toHaveBeenCalledWith('Sol')
  expect(result.structuredContent).toEqual({ displayed: true, location: { systemName: 'Sol', position: [0, 0, 0] } })
  expect(commands[0]).toMatchObject({ type: 'show_atlas', location: { systemName: 'Sol', position: [0, 0, 0] } })
  const route = routeForDisplayCommand(commands[0])
  expect(parsePhoenixRoute(phoenixRouteHash(route))).toEqual(route)
  await service.show({ systemName: ' sol ' })
  expect(getSystem).toHaveBeenLastCalledWith('sol')
  expect(commands[1].id).not.toBe(commands[0].id)
  expect(routeForDisplayCommand({ id: 'open', type: 'open_page', pageId: 'galaxy.atlas', createdAt: commands[0].createdAt }))
    .toEqual({ kind: 'information', section: 'galaxy', view: 'atlas' })
})

test('Atlas failures publish nothing and give Copilot actionable, correctly classified errors', async () => {
  const runtime = new InMemoryRuntimeStateStore()
  const publish = vi.fn()
  const getSystem = vi.fn(async (_name: string) => ({ cache: 'local' as const, system: { ...fixtureSystem('Unknown'), position: null } }))
  const tool = withToolErrorBoundary(new DisplayShowGalacticAtlasTool(new DisplayAtlasService({ publish }, { getSystem }, runtime)))
  const context = { callId: 'atlas', runId: 'atlas', deadline: '2026-10-09T12:00:00Z', signal: new AbortController().signal }
  await expect(tool.execute({}, context)).rejects.toMatchObject({ category: 'tool_validation', message: expect.stringContaining('Provide systemName') })
  expect(getSystem).not.toHaveBeenCalled()
  await expect(tool.execute({ systemName: 'Unknown' }, context)).rejects.toMatchObject({ category: 'tool_validation', message: expect.stringContaining('display.show_system_schematic') })
  getSystem.mockRejectedValueOnce(new ProviderQueryError('EDSM', 'timeout'))
  await expect(tool.execute({ systemName: 'Sol' }, context)).rejects.toMatchObject({ category: 'timeout', retryable: true })
  expect(publish).not.toHaveBeenCalled()
})

test.each(['1,2', '1,,3', '1,Infinity,3', '1,no,3', '1,2,3,4'])('Atlas route rejects invalid coordinate input %s', position => {
  expect(parsePhoenixRoute(`#/galaxy/atlas?name=Sol&position=${position}&request=unused`)).toEqual({ kind: 'information', section: 'galaxy', view: 'atlas' })
})

test('display service publishes a stable page destination', () => {
  const runtime = new InMemoryRuntimeStateStore()
  const publisher = new InProcessPublisher<DisplayCommand>()
  const display = new DisplayCommandService(
    publisher,
    runtime,
    () => new Date('2026-09-09T20:00:00.000Z')
  )
  const commands: DisplayCommand[] = []
  publisher.subscribe(command => commands.push(command))

  const result = display.openPage({ page: 'show me the plotted route' })

  expect(result.structuredContent).toEqual({ displayed: true, pageId: 'galaxy.route' })
  expect(commands).toEqual([expect.objectContaining({
    type: 'open_page',
    pageId: 'galaxy.route',
    createdAt: '2026-09-09T20:00:00.000Z'
  })])
})

function fixtureSystem (name: string): CartographicSystem {
  return {
    schemaVersion: 5,
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
    provenance: { edsm: { fetchedAt: '2026-08-11T20:00:00.000Z' }, journal: null },
    raw: {
      system: { providerSpecific: 'retained' },
      bodies: { bodies: [] },
      stations: { stations: [] }
    }
  }
}
