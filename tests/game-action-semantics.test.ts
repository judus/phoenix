import { expect, test } from 'vitest'
import type { GameActionCatalogResponse, GameActionCommand, GameActionResult } from '@phoenix/contracts'
import { GameActionService } from '../apps/server/src/application/game-action-service.js'
import type { GameActionGateway } from '../apps/server/src/domain/game-actions.js'

const catalog: GameActionCatalogResponse = {
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

test('assigns request identity and preserves explicit correlation', async () => {
  const gateway = new StubGateway()
  const service = new GameActionService(gateway)

  const result = await service.execute({
    actionId: 'elite.GalaxyMapOpen',
    correlationId: 'spoken-turn-42'
  }, 'copilot')

  expect(result.requestId).toBeTruthy()
  expect(result.correlationId).toBe('spoken-turn-42')
  expect(gateway.calls[0]?.requestId).toBe(result.requestId)
})

test('replays an idempotent action without executing the gateway twice', async () => {
  const gateway = new StubGateway()
  const service = new GameActionService(gateway)
  const request = { actionId: 'elite.GalaxyMapOpen', idempotencyKey: 'turn-7-tool-1' }

  const first = await service.execute(request, 'copilot')
  const replay = await service.execute(request, 'copilot')

  expect(replay).toEqual(first)
  expect(gateway.calls).toHaveLength(1)
})

test('propagates cancellation to the action gateway', async () => {
  const gateway = new StubGateway()
  const service = new GameActionService(gateway)
  const controller = new AbortController()
  controller.abort()

  await service.execute({ actionId: 'elite.GalaxyMapOpen' }, 'ui', controller.signal)

  expect(gateway.signals[0]?.aborted).toBe(true)
})

test('applies a bounded execution timeout', async () => {
  const gateway = new StubGateway(true)
  const service = new GameActionService(gateway)

  const result = await service.execute({ actionId: 'elite.GalaxyMapOpen', timeoutMs: 5 }, 'automation')

  expect(result.status).toBe('timed_out')
})

class StubGateway implements GameActionGateway {
  public readonly calls: GameActionCommand[] = []
  public readonly signals: Array<AbortSignal | undefined> = []

  public constructor (private readonly waitForAbort = false) {}

  public async execute (command: GameActionCommand, signal?: AbortSignal): Promise<GameActionResult> {
    this.calls.push(command)
    this.signals.push(signal)
    if (this.waitForAbort && !signal?.aborted) {
      await new Promise<void>(resolve => signal?.addEventListener('abort', () => resolve(), { once: true }))
    }
    const timedOut = signal?.reason instanceof DOMException && signal.reason.name === 'TimeoutError'
    return {
      actionId: command.actionId,
      correlationId: command.correlationId ?? command.requestId ?? 'missing',
      message: 'accepted',
      operation: command.operation,
      origin: command.origin,
      requestId: command.requestId ?? 'missing',
      status: timedOut ? 'timed_out' : signal?.aborted ? 'cancelled' : 'accepted',
      timestamp: new Date().toISOString()
    }
  }

  public getCatalog (): GameActionCatalogResponse {
    return catalog
  }
}
