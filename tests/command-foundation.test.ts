import { expect, test } from 'vitest'
import type {
  GameActionCatalogResponse,
  GameActionOrigin,
  GameActionResult
} from '@phoenix/contracts'
import { DefaultCommandRegistry } from '../apps/server/src/application/default-command-registry.js'
import { DefaultCommandDispatcher } from '../apps/server/src/application/command-dispatcher.js'
import { MacroService } from '../apps/server/src/application/macro-service.js'
import type { GameActions } from '../apps/server/src/application/game-action-service.js'
import { InMemoryMacroRepository } from '../apps/server/src/infrastructure/macro-repositories.js'

test('command identities survive catalogue sorting and unavailable actions remain discoverable', () => {
  const actions = new StubGameActions()
  const registry = new DefaultCommandRegistry(actions, [])

  const first = registry.getCatalog().commands
  actions.reverse()
  const second = registry.getCatalog().commands

  expect(first.map(command => command.id).sort()).toEqual(second.map(command => command.id).sort())
  expect(registry.find('command.elite.UnboundAction')).toMatchObject({
    id: 'command.elite.UnboundAction',
    available: false,
    unavailableReason: 'No keyboard binding is configured.'
  })
})

test('Copilot game execution follows explicit installation permissions', async () => {
  const actions = new StubGameActions()
  const registry = new DefaultCommandRegistry(actions, [])
  let allowed = false
  const dispatcher = new DefaultCommandDispatcher(
    registry,
    actions,
    [],
    undefined,
    undefined,
    () => ({ gameActions: allowed, macros: false, dangerousActions: false })
  )

  expect((await dispatcher.execute({ commandId: 'command.elite.BoundAction' }, 'copilot')).status).toBe('rejected')
  allowed = true
  expect((await dispatcher.execute({ commandId: 'command.elite.BoundAction' }, 'copilot')).status).toBe('accepted')
  expect((await dispatcher.execute({ commandId: 'command.elite.BoundAction' }, 'ui')).status).toBe('accepted')
})

test('Copilot cannot execute a dangerous action through an understated macro', async () => {
  const actions = new StubGameActions()
  const macros = new InMemoryMacroRepository()
  macros.save({
    assumptions: [],
    description: '',
    enabled: true,
    id: 'unsafe-safe',
    name: 'Unsafe safe',
    risk: 'safe',
    steps: [{ type: 'command', commandId: 'command.elite.DangerousAction', operation: 'tap' }],
    version: 2
  })
  const service = new MacroService(macros, actions)
  const registry = new DefaultCommandRegistry(actions, [], macros)
  const dispatcher = new DefaultCommandDispatcher(
    registry,
    actions,
    [],
    undefined,
    service,
    () => ({ gameActions: false, macros: true, dangerousActions: false })
  )

  expect(registry.find('command.macro.unsafe-safe')?.risk).toBe('dangerous')
  await expect(dispatcher.execute({ commandId: 'command.macro.unsafe-safe' }, 'copilot'))
    .resolves.toMatchObject({ status: 'rejected', message: 'Dangerous Copilot actions are disabled in Settings.' })
  expect(actions.calls).toEqual([])
})

class StubGameActions implements GameActions {
  public readonly calls: string[] = []
  private reversed = false

  public reverse (): void { this.reversed = !this.reversed }

  public async execute (candidate: unknown, origin: GameActionOrigin): Promise<GameActionResult> {
    const actionId = (candidate as { actionId: string }).actionId
    this.calls.push(actionId)
    return {
      actionId,
      correlationId: 'correlation-1',
      message: 'Accepted.',
      operation: 'tap',
      origin,
      requestId: 'request-1',
      status: 'accepted',
      timestamp: '2026-08-17T00:00:00.000Z'
    }
  }

  public getCatalog (): GameActionCatalogResponse {
    const actions: GameActionCatalogResponse['actions'] = [
      availability('elite.BoundAction', 'Bound action', true),
      availability('elite.UnboundAction', 'Unbound action', false),
      availability('elite.DangerousAction', 'Dangerous action', true, 'dangerous')
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

function availability (
  id: string,
  label: string,
  available: boolean,
  risk: 'routine' | 'caution' | 'dangerous' = 'routine'
): GameActionCatalogResponse['actions'][number] {
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
      risk,
      telemetryKey: null
    },
    unavailableReason: available ? null : 'No keyboard binding is configured.'
  }
}
