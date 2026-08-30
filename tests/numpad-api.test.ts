import { expect, test } from 'vitest'
import { PhoenixApplication } from '../apps/server/src/phoenix-application.js'
import { StaticEliteDangerousBindings } from './support/static-elite-dangerous-bindings.js'
import { RecordingKeyboardOutput } from 'control-deck/adapter-keyboard'
import { PhoenixApiClient } from '../apps/web/src/platform/api/phoenix-api-client.js'
import { DEFAULT_CONTROL_DECK_CONFIGURATION } from '../apps/server/src/infrastructure/default-control-deck-configuration.js'
import { controlDeckTargetToPhoenixTarget } from '@phoenix/contracts'

test('the numpad API projects and executes the current authoritative command map', async () => {
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
  const client = new PhoenixApiClient(`http://${address.host}:${address.port}`)

  try {
    await client.saveControlDeckConfiguration({
      ...DEFAULT_CONTROL_DECK_CONFIGURATION,
      decks: DEFAULT_CONTROL_DECK_CONFIGURATION.decks.map(deck => ({
        ...deck,
        elements: deck.elements.map(element => element.id === 'cell_15'
          ? { ...element, interaction: { ...element.interaction, confirmation: { kind: 'arm-then-tap', armedForMs: 5_000 } } }
          : element.id === 'cell_33'
            ? {
                ...element,
                target: { adapterId: 'phoenix.commands', commandId: 'command.elite.PrimaryFire', configuration: {} },
                interaction: { activation: 'command-default', confirmation: { kind: 'none' } }
              }
          : element)
      }))
    })
    const initial = await client.getNumpadSnapshot()
    expect(initial.nodes).toContainEqual(expect.objectContaining({ id: 'phoenix:desktop.controls', address: '1' }))
    expect(initial.nodes).toContainEqual(expect.objectContaining({ id: 'phoenix:navigation.macros.library', address: '4', label: 'Macros' }))
    expect(initial.nodes).toContainEqual(expect.objectContaining({ id: 'phoenix:navigation.log.journal', address: '5', label: 'Log' }))
    expect(initial.nodes).toContainEqual(expect.objectContaining({ id: 'phoenix:navigation.settings.dashboard', address: '6', label: 'Settings' }))
    expect(initial.nodes.find(node => node.action?.type === 'command' && node.action.target.commandId === 'command.elite.ShipSpotLightToggle'))
      .toMatchObject({ interactionHint: 'arm', bindingLabel: 'L' })
    expect(initial.nodes.find(node => node.action?.type === 'command' && node.action.target.commandId === 'command.elite.NightVisionToggle'))
      .toMatchObject({ interactionHint: 'tap', bindingLabel: 'N' })
    const hold = initial.nodes.find(node => node.action?.type === 'command' && node.action.target.commandId === 'command.elite.PrimaryFire')
    expect(hold?.action).toMatchObject({ type: 'command', activation: 'hold' })
    expect((await client.executeNumpadAddress(hold!.address, initial.revision)).status).toBe('accepted')
    expect(inputBackend.getRecordedInputs()).toEqual([
      { operation: 'press', configuration: { key: 'Space', modifiers: [] } },
      { operation: 'release', configuration: { key: 'Space', modifiers: [] } }
    ])
    expect(initial.nodes.some(node => node.address.startsWith('0'))).toBe(false)
    const destination = initial.nodes.find(node => node.action?.type === 'command' && node.action.target.commandId.startsWith('command.navigation.'))
    expect(destination).toBeDefined()

    const firstExecution = await client.executeNumpadAddress(destination!.address, initial.revision)
    expect(firstExecution.status).toBe('accepted')

    const current = await client.getNumpadSnapshot()
    const currentDestination = current.nodes.find(node => node.id === destination!.id)!
    expect(currentDestination.action?.type).toBe('command')
    if (currentDestination.action?.type !== 'command') throw new Error('Expected an executable command node.')
    const executed = await client.executeNumpadAddress(currentDestination.address, current.revision)
    expect(executed).toMatchObject({
      status: 'accepted',
      command: { target: controlDeckTargetToPhoenixTarget(currentDestination.action.target) }
    })

    const stale = await client.executeNumpadAddress(currentDestination.address, current.revision + 1)
    expect(stale.status).toBe('stale')

  } finally {
    await application.stop()
  }
})
