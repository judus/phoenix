import { expect, test } from 'vitest'
import { DefaultGameActionGateway } from '../apps/server/src/application/default-game-action-gateway.js'
import { DefaultGameActionCatalog } from '../apps/server/src/infrastructure/default-game-action-catalog.js'
import { RecordingInputBackend } from '../apps/server/src/infrastructure/recording-input-backend.js'
import { StaticGameActionBindingResolver } from '../apps/server/src/infrastructure/static-game-action-binding-resolver.js'

test('the action gateway resolves logical bindings and delegates to its input backend', async () => {
  const backend = new RecordingInputBackend()
  const gateway = new DefaultGameActionGateway(
    new DefaultGameActionCatalog(),
    new StaticGameActionBindingResolver(),
    backend
  )

  const result = await gateway.execute({
    actionId: 'ship.lights.toggle',
    operation: 'tap',
    origin: 'developer'
  })

  expect(result).toMatchObject({
    actionId: 'ship.lights.toggle',
    operation: 'tap',
    origin: 'developer',
    status: 'accepted'
  })
  expect(result.message).toContain('Simulation only')
  expect(backend.getRecordedInputs()).toEqual([{
    operation: 'tap',
    binding: { key: 'L', modifiers: [], display: 'L' }
  }])
})

test('the action gateway rejects unknown actions without touching the backend', async () => {
  const backend = new RecordingInputBackend()
  const gateway = new DefaultGameActionGateway(
    new DefaultGameActionCatalog(),
    new StaticGameActionBindingResolver(),
    backend
  )

  const result = await gateway.execute({
    actionId: 'ship.unknown.toggle',
    operation: 'tap',
    origin: 'copilot'
  })

  expect(result.status).toBe('rejected')
  expect(backend.getRecordedInputs()).toEqual([])
})
