import { expect, test } from 'vitest'
import { PhoenixApplication } from '../apps/server/src/phoenix-application.js'
import { StaticGameActionBindingResolver } from '../apps/server/src/infrastructure/static-game-action-binding-resolver.js'
import { RecordingInputBackend } from '../apps/server/src/infrastructure/recording-input-backend.js'
import { PhoenixApiClient } from '../apps/web/src/platform/api/phoenix-api-client.js'

test('the numpad API projects and executes the current authoritative command map', async () => {
  const application = new PhoenixApplication({
    actionBindingResolver: new StaticGameActionBindingResolver(),
    databasePath: ':memory:',
    eliteDirectory: null,
    host: '127.0.0.1',
    inputBackend: new RecordingInputBackend(),
    port: 0
  })
  const address = await application.start()
  const client = new PhoenixApiClient(`http://${address.host}:${address.port}`)

  try {
    const initial = await client.getNumpadSnapshot()
    expect(initial.nodes).toContainEqual(expect.objectContaining({ id: 'desktop.controls', address: '1' }))
    expect(initial.nodes).toContainEqual(expect.objectContaining({ id: 'desktop.shortcuts', address: '9' }))
    const destination = initial.nodes.find(node => node.target?.type === 'navigation')
    expect(destination).toBeDefined()

    const disabled = await client.executeNumpadAddress(destination!.address, initial.revision)
    expect(disabled).toMatchObject({ status: 'rejected', message: 'Numpad command module is disabled.' })

    const settings = await client.getModuleSettings()
    const shortcutTarget = destination!.target!
    await client.saveModuleSettings({
      ...settings,
      numpadCommands: {
        ...settings.numpadCommands,
        enabled: true,
        shortcuts: [{ id: 'panic-route', selector: '2', label: 'Panic route', target: shortcutTarget }]
      }
    })
    const current = await client.getNumpadSnapshot()
    expect(current.nodes).toContainEqual(expect.objectContaining({ id: 'desktop.shortcuts', address: '9' }))
    expect(current.nodes).toContainEqual(expect.objectContaining({
      id: 'shortcut.panic-route',
      address: '92',
      label: 'Panic route',
      target: shortcutTarget
    }))
    const currentDestination = current.nodes.find(node => node.id === destination!.id)!
    const executed = await client.executeNumpadAddress(currentDestination.address, current.revision)
    expect(executed).toMatchObject({
      status: 'accepted',
      command: { target: currentDestination.target }
    })

    const stale = await client.executeNumpadAddress(currentDestination.address, initial.revision)
    expect(stale.status).toBe('stale')

    const latestSettings = await client.getModuleSettings()
    await client.saveModuleSettings({
      ...latestSettings,
      numpadCommands: {
        ...latestSettings.numpadCommands,
        shortcuts: [{
          id: 'missing-macro',
          selector: '7',
          target: { type: 'macro', macroId: 'deleted-macro' }
        }]
      }
    })
    expect((await client.getNumpadSnapshot()).nodes).toContainEqual(expect.objectContaining({
      id: 'shortcut.missing-macro',
      address: '97',
      available: false,
      target: { type: 'macro', macroId: 'deleted-macro' }
    }))
  } finally {
    await application.stop()
  }
})
