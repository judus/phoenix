import { expect, test } from 'vitest'
import { RecordingKeyboardOutput } from '@jdu/control-deck-adapter-keyboard'
import { ControlDeckCommandService } from '@jdu/control-deck-core'
import { EliteDangerousCommandAdapter } from '@jdu/control-deck-integration-elite-dangerous'
import { ControlDeckEliteGameActionGateway } from '../apps/server/src/application/control-deck-elite-game-action-gateway.js'
import { StaticEliteDangerousBindings } from './support/static-elite-dangerous-bindings.js'

test('the PHOENIX gateway executes Elite actions through the Control Deck integration', async () => {
  const backend = new RecordingKeyboardOutput()
  const adapter = new EliteDangerousCommandAdapter({ bindings: new StaticEliteDangerousBindings(), output: backend, outputId: 'recording' })
  const gateway = new ControlDeckEliteGameActionGateway(adapter, commandService(adapter))

  const result = await gateway.execute({
    actionId: 'elite.ShipSpotLightToggle',
    operation: 'tap',
    origin: 'developer'
  })

  expect(result).toMatchObject({
    actionId: 'elite.ShipSpotLightToggle',
    operation: 'tap',
    origin: 'developer',
    status: 'accepted'
  })
  expect(result.message).toContain('Simulation only')
  expect(backend.getRecordedInputs()).toEqual([{
    operation: 'tap',
    configuration: { key: 'L', modifiers: [] }
  }])
})

test('the action gateway rejects unknown actions without touching the backend', async () => {
  const backend = new RecordingKeyboardOutput()
  const adapter = new EliteDangerousCommandAdapter({ bindings: new StaticEliteDangerousBindings(), output: backend, outputId: 'recording' })
  const gateway = new ControlDeckEliteGameActionGateway(adapter, commandService(adapter))

  const result = await gateway.execute({
    actionId: 'ship.unknown.toggle',
    operation: 'tap',
    origin: 'copilot'
  })

  expect(result.status).toBe('rejected')
  expect(backend.getRecordedInputs()).toEqual([])
})

function commandService (adapter: EliteDangerousCommandAdapter): ControlDeckCommandService {
  let id = 0
  return new ControlDeckCommandService([adapter], { createId: () => `test-${++id}` })
}
