import { expect, test } from 'vitest'
import { PhoenixApplication } from '../apps/server/src/phoenix-application.js'
import { StaticEliteDangerousBindings } from './support/static-elite-dangerous-bindings.js'
import { RecordingKeyboardOutput } from 'control-deck/adapter-keyboard'
import { PhoenixApiClient } from '../apps/web/src/platform/api/phoenix-api-client.js'
import { DEFAULT_CONTROL_DECK_CONFIGURATION } from '../apps/server/src/infrastructure/default-control-deck-configuration.js'

test('the numpad API projects and executes the current authoritative command map', async () => {
  const application = new PhoenixApplication({
    eliteBindings: new StaticEliteDangerousBindings(),
    databasePath: ':memory:',
    eliteDirectory: null,
    host: '127.0.0.1',
    keyboardOutput: new RecordingKeyboardOutput(),
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
          : element)
      }))
    })
    const initial = await client.getNumpadSnapshot()
    expect(initial.nodes).toContainEqual(expect.objectContaining({ id: 'desktop.controls', address: '1' }))
    expect(initial.nodes).toContainEqual(expect.objectContaining({ id: 'navigation.macros.library', address: '4', label: 'Macros' }))
    expect(initial.nodes).toContainEqual(expect.objectContaining({ id: 'navigation.log.journal', address: '5', label: 'Log' }))
    expect(initial.nodes).toContainEqual(expect.objectContaining({ id: 'navigation.settings.dashboard', address: '6', label: 'Settings' }))
    expect(initial.nodes.find(node => node.target?.type === 'game-action' && node.target.actionId === 'elite.ShipSpotLightToggle'))
      .toMatchObject({ interactionHint: 'arm', bindingLabel: 'L' })
    expect(initial.nodes.find(node => node.target?.type === 'game-action' && node.target.actionId === 'elite.NightVisionToggle'))
      .toMatchObject({ interactionHint: 'tap', bindingLabel: 'N' })
    expect(initial.nodes.some(node => node.address.startsWith('0'))).toBe(false)
    const destination = initial.nodes.find(node => node.target?.type === 'navigation')
    expect(destination).toBeDefined()

    const firstExecution = await client.executeNumpadAddress(destination!.address, initial.revision)
    expect(firstExecution.status).toBe('accepted')

    const current = await client.getNumpadSnapshot()
    const currentDestination = current.nodes.find(node => node.id === destination!.id)!
    const executed = await client.executeNumpadAddress(currentDestination.address, current.revision)
    expect(executed).toMatchObject({
      status: 'accepted',
      command: { target: currentDestination.target }
    })

    const stale = await client.executeNumpadAddress(currentDestination.address, current.revision + 1)
    expect(stale.status).toBe('stale')

  } finally {
    await application.stop()
  }
})
