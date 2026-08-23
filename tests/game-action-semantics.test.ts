import { afterEach, expect, test, vi } from 'vitest'
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

afterEach(() => vi.useRealTimers())

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

test('serializes a hold lease and rejects release before press', async () => {
  const gateway = new StubGateway()
  const service = new GameActionService(gateway)

  const orphan = await service.execute({ actionId: 'elite.PrimaryFire', operation: 'release', leaseId: 'gesture-1' }, 'ui')
  const press = service.execute({ actionId: 'elite.PrimaryFire', operation: 'press', leaseId: 'gesture-2' }, 'ui')
  const release = service.execute({ actionId: 'elite.PrimaryFire', operation: 'release', leaseId: 'gesture-2' }, 'ui')

  expect(orphan.status).toBe('rejected')
  await expect(Promise.all([press, release])).resolves.toEqual([
    expect.objectContaining({ operation: 'press', status: 'accepted' }),
    expect.objectContaining({ operation: 'release', status: 'accepted' })
  ])
  expect(gateway.calls.map(call => call.operation)).toEqual(['press', 'release'])
  await service.stop()
})

test('rejects hold transitions that do not identify their lease', async () => {
  const gateway = new StubGateway()
  const service = new GameActionService(gateway)

  const result = await service.execute({ actionId: 'elite.PrimaryFire', operation: 'press' }, 'ui')

  expect(result).toMatchObject({ status: 'rejected', message: 'Hold actions require a lease ID.' })
  expect(gateway.calls).toHaveLength(0)
})

test('automatically releases an expired hold lease', async () => {
  const gateway = new StubGateway()
  const service = new GameActionService(gateway, 5)

  await service.execute({ actionId: 'elite.PrimaryFire', operation: 'press', leaseId: 'gesture-2' }, 'ui')
  await new Promise(resolve => setTimeout(resolve, 15))

  expect(gateway.calls.map(call => call.operation)).toEqual(['press', 'release'])
  await service.stop()
})

test('renews an active hold without sending another keydown', async () => {
  vi.useFakeTimers()
  const gateway = new StubGateway()
  const service = new GameActionService(gateway, 20)

  await service.execute({ actionId: 'elite.PrimaryFire', operation: 'press', leaseId: 'gesture-renewed' }, 'ui')
  await vi.advanceTimersByTimeAsync(10)
  const renewal = await service.execute({ actionId: 'elite.PrimaryFire', operation: 'press', leaseId: 'gesture-renewed' }, 'ui')
  await vi.advanceTimersByTimeAsync(15)

  expect(renewal).toMatchObject({ status: 'accepted', message: 'Hold lease renewed.' })
  expect(gateway.calls.map(call => call.operation)).toEqual(['press'])

  await vi.advanceTimersByTimeAsync(15)
  expect(gateway.calls.map(call => call.operation)).toEqual(['press', 'release'])
  await service.stop()
})

test('a release arriving before its press permanently closes that gesture', async () => {
  const gateway = new StubGateway()
  const service = new GameActionService(gateway)

  const release = await service.execute({ actionId: 'elite.PrimaryFire', operation: 'release', leaseId: 'late-gesture' }, 'ui')
  const latePress = await service.execute({ actionId: 'elite.PrimaryFire', operation: 'press', leaseId: 'late-gesture' }, 'ui')

  expect(release.status).toBe('rejected')
  expect(latePress).toMatchObject({ status: 'rejected', message: 'This hold lease is already closed.' })
  expect(gateway.calls).toHaveLength(0)
})

test('releases every active hold lease during shutdown', async () => {
  const gateway = new StubGateway()
  const service = new GameActionService(gateway)

  await service.execute({ actionId: 'elite.PrimaryFire', operation: 'press', leaseId: 'gesture-3' }, 'ui')
  await service.execute({ actionId: 'elite.LateralThrust', operation: 'press', leaseId: 'gesture-4' }, 'ui')
  await service.stop()

  expect(gateway.calls.map(call => [call.actionId, call.operation])).toEqual([
    ['elite.PrimaryFire', 'press'],
    ['elite.LateralThrust', 'press'],
    ['elite.PrimaryFire', 'release'],
    ['elite.LateralThrust', 'release']
  ])
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
