import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, test, vi } from 'vitest'
import { ControlDeckCommandService } from 'control-deck/core'
import { RecordingKeyboardOutput } from 'control-deck/adapter-keyboard'
import { EliteDangerousCommandAdapter } from 'control-deck/integration-elite-dangerous'
import { createEmptyRuntimeState } from '@phoenix/contracts'
import { parseEliteStatus } from '@phoenix/elite'
import { ControlDeckEliteGameActionGateway } from '../apps/server/src/application/control-deck-elite-game-action-gateway.js'
import { GameActionService } from '../apps/server/src/application/game-action-service.js'
import { PhoenixControlDeckCommandStateProvider } from '../apps/server/src/application/phoenix-control-deck-command-state-provider.js'
import { InMemoryRuntimeStateStore } from '../apps/server/src/infrastructure/in-memory-runtime-state-store.js'
import { InProcessPublisher } from '../apps/server/src/infrastructure/in-process-publisher.js'
import { StaticEliteDangerousBindings } from './support/static-elite-dangerous-bindings.js'

const fixturePath = fileURLToPath(new URL('./fixtures/elite/status-docked.json', import.meta.url))

test('publishes only observable PHOENIX command state and relays runtime changes', () => {
  const adapter = new EliteDangerousCommandAdapter({
    bindings: new StaticEliteDangerousBindings(),
    output: new RecordingKeyboardOutput(),
    outputId: 'recording'
  })
  const actions = new GameActionService(new ControlDeckEliteGameActionGateway(
    adapter,
    new ControlDeckCommandService([adapter], { createId: () => 'state-provider' })
  ))
  const runtimeState = new InMemoryRuntimeStateStore()
  const state = {
    ...createEmptyRuntimeState(),
    revision: 1,
    updatedAt: '2026-08-30T12:00:00.000Z',
    gameStatus: parseEliteStatus(JSON.parse(readFileSync(fixturePath, 'utf8')))
  }
  runtimeState.replace(state)
  const updates = new InProcessPublisher<typeof state>()
  const provider = new PhoenixControlDeckCommandStateProvider(actions, runtimeState, updates)
  const changed = vi.fn()
  const unsubscribe = provider.subscribeCommandStates(changed)

  expect(provider.getCommandStates()).toContainEqual({
    target: {
      adapterId: 'phoenix.commands',
      commandId: 'command.elite.ShipSpotLightToggle',
      configuration: {}
    },
    value: true,
    observedAt: state.updatedAt
  })
  expect(provider.getCommandStates().some(candidate => (
    candidate.target.commandId === 'command.elite.GalaxyMapOpen'
  ))).toBe(false)

  updates.publish(state)
  expect(changed).toHaveBeenCalledOnce()
  unsubscribe()
})
