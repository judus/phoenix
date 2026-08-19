import { expect, test } from 'vitest'
import type {
  GameActionCatalogResponse,
  GameActionOrigin,
  GameActionResult
} from '@phoenix/contracts'
import { MacroService } from '../apps/server/src/application/macro-service.js'
import type { GameActions } from '../apps/server/src/application/game-action-service.js'
import { InMemoryMacroRepository } from '../apps/server/src/infrastructure/macro-repositories.js'

test('aborting playback releases every held action', async () => {
  const actions = new StubGameActions()
  const repository = new InMemoryMacroRepository()
  repository.save({
    assumptions: [],
    description: '',
    enabled: true,
    id: 'held-input',
    name: 'Held input',
    risk: 'safe',
    steps: [
      { type: 'game-action', actionId: 'elite.PrimaryFire', operation: 'press' },
      { type: 'wait', durationMs: 10_000 }
    ],
    version: 1
  })
  const service = new MacroService(repository, actions)

  const playback = service.execute('held-input', 'ui')
  await new Promise(resolve => setTimeout(resolve, 0))
  service.abortPlayback()

  await expect(playback).resolves.toMatchObject({ status: 'aborted' })
  expect(actions.calls).toEqual([
    expect.objectContaining({ actionId: 'elite.PrimaryFire', operation: 'press' }),
    expect.objectContaining({ actionId: 'elite.PrimaryFire', operation: 'release' })
  ])
  expect(actions.calls[0]?.leaseId).toBeTruthy()
  expect(actions.calls[1]?.leaseId).toBe(actions.calls[0]?.leaseId)
})

test('saving derives macro risk from its game actions', () => {
  const actions = new StubGameActions()
  const repository = new InMemoryMacroRepository()
  const service = new MacroService(repository, actions)

  expect(service.save({
    assumptions: [],
    description: '',
    enabled: true,
    id: 'dangerous-action',
    name: 'Dangerous action',
    risk: 'safe',
    steps: [{ type: 'game-action', actionId: 'elite.EjectAllCargo', operation: 'tap' }],
    version: 1
  }).risk).toBe('dangerous')
  expect(repository.get('dangerous-action')?.risk).toBe('dangerous')
})

test('macro recording owns and releases hold leases', async () => {
  const actions = new StubGameActions()
  const service = new MacroService(new InMemoryMacroRepository(), actions)
  const recording = service.startRecording('desktop-client')

  await service.recordAction(recording.id, {
    actionId: 'elite.PrimaryFire',
    clientId: 'desktop-client',
    operation: 'press'
  })
  await service.stopRecording(recording.id, 'desktop-client')

  expect(actions.calls).toEqual([
    expect.objectContaining({ actionId: 'elite.PrimaryFire', operation: 'press' }),
    expect.objectContaining({ actionId: 'elite.PrimaryFire', operation: 'release' })
  ])
  expect(actions.calls[0]?.leaseId).toBeTruthy()
  expect(actions.calls[1]?.leaseId).toBe(actions.calls[0]?.leaseId)
})

test('macro playback rechecks dangerous Copilot actions', async () => {
  const actions = new StubGameActions()
  const repository = new InMemoryMacroRepository()
  repository.save({
    assumptions: [],
    description: '',
    enabled: true,
    id: 'understated',
    name: 'Understated',
    risk: 'safe',
    steps: [{ type: 'game-action', actionId: 'elite.EjectAllCargo', operation: 'tap' }],
    version: 1
  })
  const service = new MacroService(
    repository,
    actions,
    undefined,
    () => ({ gameActions: false, macros: true, dangerousActions: false })
  )

  await expect(service.execute('understated', 'copilot')).resolves.toMatchObject({
    status: 'failed',
    message: 'Dangerous Copilot actions are disabled in Settings.'
  })
  expect(actions.calls).toEqual([])
})

class StubGameActions implements GameActions {
  public readonly calls: Array<{ actionId: string, leaseId?: string, operation: string }> = []

  public async execute (candidate: unknown, origin: GameActionOrigin): Promise<GameActionResult> {
    const request = candidate as { actionId: string, leaseId?: string, operation: 'tap' | 'press' | 'release' }
    this.calls.push({ actionId: request.actionId, leaseId: request.leaseId, operation: request.operation })
    return {
      actionId: request.actionId,
      correlationId: 'test',
      message: 'accepted',
      operation: request.operation,
      origin,
      requestId: 'test',
      status: 'accepted',
      timestamp: new Date().toISOString()
    }
  }

  public getCatalog (): GameActionCatalogResponse {
    return {
      actions: [{
        available: true,
        binding: { display: 'J', key: 'J', modifiers: [] },
        definition: {
          category: 'misc',
          description: 'Eject all cargo.',
          eliteBinding: 'EjectAllCargo',
          id: 'elite.EjectAllCargo',
          inputMode: 'tap',
          label: 'Eject all cargo',
          risk: 'dangerous',
          telemetryKey: null
        },
        unavailableReason: null
      }],
      backend: { available: true, detail: 'test', id: 'test', simulated: true },
      bindingSource: {
        available: true,
        bindingCount: 0,
        directory: null,
        error: null,
        filePath: null,
        keyboardBindingCount: 0,
        loadedAt: null,
        presetNames: []
      }
    }
  }
}
