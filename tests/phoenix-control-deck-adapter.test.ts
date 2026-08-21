import {
  ControlDeckCommandCatalogueSchema,
  ControlDeckCommandExecutionResultSchema
} from '@jdu/control-deck-core'
import { expect, test } from 'vitest'
import { PhoenixApplication } from '../apps/server/src/phoenix-application.js'
import { RecordingKeyboardOutput } from '@jdu/control-deck-adapter-keyboard'
import { StaticEliteDangerousBindings } from './support/static-elite-dangerous-bindings.js'

test('PHOENIX exposes its authoritative commands through the Control Deck adapter API', async () => {
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
    const catalogueResponse = await fetch(`${baseUrl}/api/control-deck/commands`)
    expect(catalogueResponse.status).toBe(200)
    const catalogue = ControlDeckCommandCatalogueSchema.parse(await catalogueResponse.json())
    const adapter = catalogue.adapters.find(candidate => candidate.id === 'phoenix.commands')
    expect(adapter).toMatchObject({ holdOwner: 'adapter', available: true })
    expect(adapter?.commands.find(command => command.id === 'command.elite.ShipSpotLightToggle'))
      .toMatchObject({ available: true, bindingLabel: 'L', operations: ['tap'], simulated: true })
    expect(adapter?.commands.find(command => command.id === 'command.elite.PrimaryFire'))
      .toMatchObject({ available: true, bindingLabel: 'Space', operations: ['press', 'release'], simulated: true })
    expect(adapter?.commands.find(command => command.id === 'command.navigation.galaxy.current-system'))
      .toMatchObject({ operations: ['tap'], simulated: false })

    expect(await execute(baseUrl, 'command.elite.ShipSpotLightToggle', 'tap'))
      .toMatchObject({ status: 'accepted', simulated: true })
    expect(await execute(baseUrl, 'command.elite.PrimaryFire', 'press', 'hold-1'))
      .toMatchObject({ status: 'accepted' })
    expect(await execute(baseUrl, 'command.elite.PrimaryFire', 'press', 'hold-1'))
      .toMatchObject({ status: 'accepted', message: 'Hold lease renewed.' })
    expect(await execute(baseUrl, 'command.elite.PrimaryFire', 'release', 'hold-1'))
      .toMatchObject({ status: 'accepted' })

    expect(inputBackend.getRecordedInputs()).toEqual([
      { operation: 'tap', configuration: { key: 'L', modifiers: [] } },
      { operation: 'press', configuration: { key: 'Space', modifiers: [] } },
      { operation: 'release', configuration: { key: 'Space', modifiers: [] } }
    ])

    expect(await execute(baseUrl, 'command.navigation.galaxy.current-system', 'tap'))
      .toMatchObject({
        status: 'accepted',
        data: { navigationHref: '#/galaxy/system' }
      })
  } finally {
    await application.stop()
  }
})

async function execute (
  baseUrl: string,
  commandId: string,
  operation: 'tap' | 'press' | 'release',
  leaseId?: string
) {
  const response = await fetch(`${baseUrl}/api/control-deck/commands/execute`, {
    body: JSON.stringify({
      target: { adapterId: 'phoenix.commands', commandId, configuration: {} },
      operation,
      ...(leaseId ? { leaseId } : {})
    }),
    headers: { 'content-type': 'application/json' },
    method: 'POST'
  })
  expect(response.status).toBe(200)
  return ControlDeckCommandExecutionResultSchema.parse(await response.json())
}
