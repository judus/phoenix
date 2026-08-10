import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, test } from 'vitest'
import { createEmptyRuntimeState } from '@phoenix/contracts'
import { parseEliteStatus } from '@phoenix/elite'
import { DefaultGameActionGateway } from '../apps/server/src/application/default-game-action-gateway.js'
import { GameActionService } from '../apps/server/src/application/game-action-service.js'
import { StatefulGameActionService } from '../apps/server/src/application/stateful-game-action-service.js'
import { DefaultGameActionCatalog } from '../apps/server/src/infrastructure/default-game-action-catalog.js'
import { InMemoryRuntimeStateStore } from '../apps/server/src/infrastructure/in-memory-runtime-state-store.js'
import { RecordingInputBackend } from '../apps/server/src/infrastructure/recording-input-backend.js'
import { StaticGameActionBindingResolver } from '../apps/server/src/infrastructure/static-game-action-binding-resolver.js'

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
    binding: { display: 'L', key: 'L', modifiers: [] },
    operation: 'tap'
  }])
})

function fixture () {
  const backend = new RecordingInputBackend()
  const bindings = new StaticGameActionBindingResolver()
  const actions = new GameActionService(new DefaultGameActionGateway(
    new DefaultGameActionCatalog(bindings),
    bindings,
    backend
  ))
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
