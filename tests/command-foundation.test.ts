import { expect, test } from 'vitest'
import type {
  GameActionCatalogResponse,
  GameActionOrigin,
  GameActionResult
} from '@phoenix/contracts'
import { DefaultCommandRegistry } from '../apps/server/src/application/default-command-registry.js'
import type { GameActions } from '../apps/server/src/application/game-action-service.js'

test('command identities survive catalogue sorting and unavailable actions remain discoverable', () => {
  const actions = new StubGameActions()
  const registry = new DefaultCommandRegistry(actions, [])

  const first = registry.getCatalog().commands
  actions.reverse()
  const second = registry.getCatalog().commands

  expect(first.map(command => command.id).sort()).toEqual(second.map(command => command.id).sort())
  expect(registry.find({ type: 'game-action', actionId: 'elite.UnboundAction' })).toMatchObject({
    id: 'command.elite.UnboundAction',
    available: false,
    unavailableReason: 'No keyboard binding is configured.'
  })
})

class StubGameActions implements GameActions {
  private reversed = false

  public reverse (): void { this.reversed = !this.reversed }

  public async execute (_candidate: unknown, _origin: GameActionOrigin): Promise<GameActionResult> {
    throw new Error('Not used by this registry test.')
  }

  public getCatalog (): GameActionCatalogResponse {
    const actions: GameActionCatalogResponse['actions'] = [
      availability('elite.BoundAction', 'Bound action', true),
      availability('elite.UnboundAction', 'Unbound action', false)
    ]
    return {
      actions: this.reversed ? actions.reverse() : actions,
      backend: { available: true, detail: 'test', id: 'test', simulated: true },
      bindingSource: {
        available: true,
        bindingCount: 1,
        directory: null,
        error: null,
        filePath: null,
        keyboardBindingCount: 1,
        loadedAt: null,
        presetNames: []
      }
    }
  }
}

function availability (id: string, label: string, available: boolean): GameActionCatalogResponse['actions'][number] {
  return {
    available,
    binding: available ? { key: 'K', modifiers: [], display: 'K' } : null,
    definition: {
      category: 'misc',
      description: `${label}.`,
      eliteBinding: id.replace('elite.', ''),
      id,
      inputMode: 'tap',
      label,
      risk: 'routine',
      telemetryKey: null
    },
    unavailableReason: available ? null : 'No keyboard binding is configured.'
  }
}
