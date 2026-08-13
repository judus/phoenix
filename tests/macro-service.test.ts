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
    { actionId: 'elite.PrimaryFire', operation: 'press' },
    { actionId: 'elite.PrimaryFire', operation: 'release' }
  ])
})

class StubGameActions implements GameActions {
  public readonly calls: Array<{ actionId: string, operation: string }> = []

  public async execute (candidate: unknown, origin: GameActionOrigin): Promise<GameActionResult> {
    const request = candidate as { actionId: string, operation: 'tap' | 'press' | 'release' }
    this.calls.push({ actionId: request.actionId, operation: request.operation })
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
      actions: [],
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
