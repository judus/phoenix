import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, test } from 'vitest'
import { ControlDeckCommandService } from '@jdu/control-deck-core'
import { EliteDangerousCommandAdapter } from '@jdu/control-deck-integration-elite-dangerous'
import { createEmptyRuntimeState } from '@phoenix/contracts'
import { parseEliteStatus } from '@phoenix/elite'
import { ControlDeckEliteGameActionGateway } from '../apps/server/src/application/control-deck-elite-game-action-gateway.js'
import { GameActionService } from '../apps/server/src/application/game-action-service.js'
import { StatefulGameActionService } from '../apps/server/src/application/stateful-game-action-service.js'
import { InMemoryRuntimeStateStore } from '../apps/server/src/infrastructure/in-memory-runtime-state-store.js'
import { RecordingKeyboardOutput } from '@jdu/control-deck-adapter-keyboard'
import { StaticEliteDangerousBindings } from './support/static-elite-dangerous-bindings.js'

const fixturePath = fileURLToPath(new URL('./fixtures/elite/status-docked.json', import.meta.url))

test('a stateful action does not toggle a switch that already has the requested state', async () => {
  const { backend, service } = fixture()

  const result = await service.setSwitch({
    actionId: 'elite.ShipSpotLightToggle',
    enabled: true
  })

  expect(result).toMatchObject({
    actionId: 'elite.ShipSpotLightToggle',
    status: 'already_satisfied'
  })
  expect(backend.getRecordedInputs()).toEqual([])
})

test('a stateful action distinguishes telemetry confirmation from accepted input', async () => {
  const { backend, service, state } = fixture()
  setTimeout(() => {
    const current = state.getCurrent()
    if (current.gameStatus === null) throw new Error('Expected game status.')
    state.replace({
      ...current,
      gameStatus: {
        ...current.gameStatus,
        flags: { ...current.gameStatus.flags, lightsOn: false }
      }
    })
  }, 10)

  const result = await service.setSwitch({
    actionId: 'elite.ShipSpotLightToggle',
    enabled: false
  })

  expect(result.status).toBe('confirmed')
  expect(backend.getRecordedInputs()).toEqual([{
    configuration: { key: 'L', modifiers: [] },
    operation: 'tap'
  }])
})

function fixture () {
  const backend = new RecordingKeyboardOutput()
  const bindings = new StaticEliteDangerousBindings()
  const adapter = new EliteDangerousCommandAdapter({ bindings, output: backend, outputId: 'recording' })
  let id = 0
  const commands = new ControlDeckCommandService([adapter], { createId: () => `stateful-${++id}` })
  const actions = new GameActionService(new ControlDeckEliteGameActionGateway(adapter, commands))
  const state = new InMemoryRuntimeStateStore()
  state.replace({
    ...createEmptyRuntimeState(),
    gameStatus: parseEliteStatus(JSON.parse(readFileSync(fixturePath, 'utf8')))
  })
  return {
    backend,
    service: new StatefulGameActionService(actions, state, 100, 5),
    state
  }
}
