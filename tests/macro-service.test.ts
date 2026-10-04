import { expect, test, vi } from 'vitest'
import { getEventListeners } from 'node:events'
import type {
  GameActionCatalogResponse,
  GameActionCommand,
  GameActionOrigin,
  GameActionResult
} from '@phoenix/contracts'
import { MacroService } from '../apps/server/src/application/macro-service.js'
import { ActivityLogService } from '../apps/server/src/application/activity-log-service.js'
import { LoggedGameActions } from '../apps/server/src/application/logged-game-actions.js'
import { GameActionService, type GameActions } from '../apps/server/src/application/game-action-service.js'
import { InMemoryMacroRepository } from '../apps/server/src/infrastructure/macro-repositories.js'

test('completed wait steps release their composed-signal abort listeners', async () => {
  const any = vi.spyOn(AbortSignal, 'any')
  try {
    const repository = new InMemoryMacroRepository()
    repository.save({ assumptions: [], description: '', enabled: true, id: 'waits', name: 'Waits', risk: 'safe',
      steps: Array.from({ length: 12 }, () => ({ type: 'wait' as const, durationMs: 1 })), version: 1 })
    const playback = await new MacroService(repository, new StubGameActions()).execute('waits', 'ui')
    expect(playback).toMatchObject({ completedSteps: 12, status: 'completed' })
    const signal = any.mock.results[0]!.value as AbortSignal
    expect(getEventListeners(signal, 'abort')).toHaveLength(0)
  } finally { any.mockRestore() }
})

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

test.each(['persistence', 'listener'] as const)('failed final release %s preserves the error and permits later playback', async failure => {
  const actions = new StubGameActions()
  const original = new Error(`Release ${failure} failed after input.`)
  let fail = true
  const log = new ActivityLogService({
    getRecentActivity: () => [],
    putActivity: entry => {
      if (failure === 'persistence' && fail && entry.data.operation === 'release') throw original
    }
  })
  log.subscribe(entry => {
    if (failure === 'listener' && fail && entry.data.operation === 'release') throw original
  })
  const service = heldMacroService(new LoggedGameActions(actions, log))

  await expect(service.execute('holds', 'ui')).rejects.toBe(original)
  expect(service.getPlayback()).toBeNull()
  expect(actions.calls.map(call => [call.actionId, call.operation])).toEqual([
    ['elite.PrimaryFire', 'press'], ['elite.SecondaryFire', 'press'],
    ['elite.PrimaryFire', 'release'], ['elite.SecondaryFire', 'release']
  ])
  for (const actionId of ['elite.PrimaryFire', 'elite.SecondaryFire']) {
    expect(actions.calls.find(call => call.actionId === actionId && call.operation === 'release')?.leaseId)
      .toBe(actions.calls.find(call => call.actionId === actionId && call.operation === 'press')?.leaseId)
  }

  fail = false
  await expect(service.execute('holds', 'ui')).resolves.toMatchObject({ status: 'completed' })
  expect(service.getPlayback()).toBeNull()
  expect(actions.calls).toHaveLength(8)
})

test.each(['persistence', 'listener'] as const)('a press with failed post-input %s is released without retrying the press', async failure => {
  const actions = new StubGameActions()
  const original = new Error(`Press ${failure} failed after input.`)
  const log = new ActivityLogService({
    getRecentActivity: () => [],
    putActivity: entry => {
      if (failure === 'persistence' && entry.data.operation === 'press') throw original
    }
  })
  log.subscribe(entry => {
    if (failure === 'listener' && entry.data.operation === 'press') throw original
  })
  const service = heldMacroService(new LoggedGameActions(actions, log))

  await expect(service.execute('holds', 'ui')).resolves.toMatchObject({
    completedSteps: 0, message: original.message, status: 'failed'
  })
  expect(actions.calls.map(call => call.operation)).toEqual(['press', 'release'])
  expect(actions.calls[1]?.leaseId).toBe(actions.calls[0]?.leaseId)
  expect(service.getPlayback()).toBeNull()
})

test('an explicit release with failed post-input logging is not released again during finalization', async () => {
  const actions = new StubGameActions()
  const original = new Error('Release logging failed after input.')
  const log = new ActivityLogService({
    getRecentActivity: () => [],
    putActivity: entry => { if (entry.data.operation === 'release') throw original }
  })
  const repository = new InMemoryMacroRepository()
  repository.save({ assumptions: [], description: '', enabled: true, id: 'explicit-release', name: 'Explicit release', risk: 'safe',
    steps: [
      { type: 'game-action', actionId: 'elite.PrimaryFire', operation: 'press' },
      { type: 'game-action', actionId: 'elite.PrimaryFire', operation: 'release' }
    ], version: 1 })
  const service = new MacroService(repository, new LoggedGameActions(actions, log))

  await expect(service.execute('explicit-release', 'ui')).resolves.toMatchObject({
    completedSteps: 1, message: original.message, status: 'failed'
  })
  expect(actions.calls.map(call => call.operation)).toEqual(['press', 'release'])
  expect(service.getPlayback()).toBeNull()
})

test('playback remains owned until every final release settles even when another release has failed', async () => {
  const actions = new StubGameActions()
  const original = new Error('First release failed.')
  let completeSecond!: () => void
  const secondRelease = new Promise<void>(resolve => { completeSecond = resolve })
  const execute = vi.fn(async (candidate: unknown, origin: GameActionOrigin) => {
    const result = await actions.execute(candidate, origin)
    if (result.operation === 'release') {
      if (result.actionId === 'elite.PrimaryFire') throw original
      await secondRelease
    }
    return result
  })
  const service = heldMacroService({ execute, getCatalog: () => actions.getCatalog() })
  const outcome = service.execute('holds', 'ui').catch(cause => cause)
  await vi.waitFor(() => expect(actions.calls).toHaveLength(4))
  expect(service.getPlayback()).not.toBeNull()
  await expect(service.execute('holds', 'ui')).rejects.toThrow('already running')

  completeSecond()
  await expect(outcome).resolves.toBe(original)
  expect(service.getPlayback()).toBeNull()
  expect(execute).toHaveBeenCalledTimes(4)
})

test('synchronous release exceptions do not skip other held-action release attempts', async () => {
  const actions = new StubGameActions()
  const original = new Error('Synchronous release failure.')
  const execute = vi.fn((candidate: unknown, origin: GameActionOrigin) => {
    const result = actions.execute(candidate, origin)
    if ((candidate as { operation: string }).operation === 'release') throw original
    return result
  })
  const service = heldMacroService({ execute, getCatalog: () => actions.getCatalog() })

  await expect(service.execute('holds', 'ui')).rejects.toBe(original)
  expect(actions.calls.map(call => call.operation)).toEqual(['press', 'press', 'release', 'release'])
  expect(service.getPlayback()).toBeNull()
})

test('primary playback failure remains visible when its safety release also fails', async () => {
  const actions = new StubGameActions()
  const primary = new Error('Press persistence failed after input.')
  const cleanup = new Error('Release persistence failed after input.')
  const log = new ActivityLogService({
    getRecentActivity: () => [],
    putActivity: entry => { throw entry.data.operation === 'press' ? primary : cleanup }
  })
  const service = heldMacroService(new LoggedGameActions(actions, log))

  await expect(service.execute('holds', 'ui')).resolves.toMatchObject({
    completedSteps: 0,
    message: `${primary.message} Held-action cleanup failed: ${cleanup.message}`,
    status: 'failed'
  })
  expect(actions.calls.map(call => call.operation)).toEqual(['press', 'release'])
  expect(service.getPlayback()).toBeNull()
})

test('abort status and primary diagnostic survive failed cleanup of every held action', async () => {
  const actions = new StubGameActions()
  const cleanup = new Error('Release listener failed after input.')
  const log = new ActivityLogService({ getRecentActivity: () => [], putActivity: () => undefined })
  log.subscribe(entry => { if (entry.data.operation === 'release') throw cleanup })
  const repository = new InMemoryMacroRepository()
  repository.save({ assumptions: [], description: '', enabled: true, id: 'abort-cleanup', name: 'Abort cleanup', risk: 'safe',
    steps: [
      { type: 'game-action', actionId: 'elite.PrimaryFire', operation: 'press' },
      { type: 'game-action', actionId: 'elite.SecondaryFire', operation: 'press' },
      { type: 'wait', durationMs: 10_000 }
    ], version: 1 })
  const service = new MacroService(repository, new LoggedGameActions(actions, log))
  const playback = service.execute('abort-cleanup', 'ui')
  await vi.waitFor(() => expect(service.getPlayback()?.completedSteps).toBe(2))
  service.abortPlayback()

  await expect(playback).resolves.toMatchObject({
    completedSteps: 2,
    message: `Macro playback aborted. Held-action cleanup failed: ${cleanup.message}`,
    status: 'aborted'
  })
  expect(actions.calls.map(call => call.operation)).toEqual(['press', 'press', 'release', 'release'])
  expect(service.getPlayback()).toBeNull()
  expect(service.abortPlayback()).toBeNull()
})

test('a reserved press that failed before dispatch does not send an unmatched release through the gateway', async () => {
  const actions = new StubGameActions()
  const original = new Error('Press failed before game input.')
  const dispatch = vi.fn(async (_command: GameActionCommand) => { throw original })
  const gameActions = new GameActionService({ execute: dispatch, getCatalog: () => actions.getCatalog() })
  const service = heldMacroService(gameActions)

  try {
    await expect(service.execute('holds', 'ui')).resolves.toMatchObject({
      completedSteps: 0, message: original.message, status: 'failed'
    })
    expect(dispatch).toHaveBeenCalledOnce()
    expect(dispatch.mock.calls[0]?.[0]).toMatchObject({ operation: 'press' })
    expect(service.getPlayback()).toBeNull()
  } finally { await gameActions.stop() }
})

test('accepted press followed by logging failure releases the actual runtime lease exactly once', async () => {
  const actions = new StubGameActions()
  const original = new Error('Press logging failed after input.')
  const gameActions = new GameActionService({
    execute: command => actions.execute(command, command.origin),
    getCatalog: () => actions.getCatalog()
  })
  const log = new ActivityLogService({
    getRecentActivity: () => [],
    putActivity: entry => { if (entry.data.operation === 'press') throw original }
  })
  const service = heldMacroService(new LoggedGameActions(gameActions, log))

  try {
    await expect(service.execute('holds', 'ui')).resolves.toMatchObject({
      completedSteps: 0, message: original.message, status: 'failed'
    })
    expect(actions.calls.map(call => call.operation)).toEqual(['press', 'release'])
    expect(actions.calls[1]?.leaseId).toBe(actions.calls[0]?.leaseId)
    expect(service.getPlayback()).toBeNull()
  } finally { await gameActions.stop() }
  expect(actions.calls).toHaveLength(2)
})

function heldMacroService (actions: GameActions): MacroService {
  const repository = new InMemoryMacroRepository()
  repository.save({ assumptions: [], description: '', enabled: true, id: 'holds', name: 'Held inputs', risk: 'safe',
    steps: [
      { type: 'game-action', actionId: 'elite.PrimaryFire', operation: 'press' },
      { type: 'game-action', actionId: 'elite.SecondaryFire', operation: 'press' }
    ], version: 1 })
  return new MacroService(repository, actions)
}

test.each(['stop', 'cancel'] as const)('recording %s releases a press with failed post-input logging without recording or retrying it', async operation => {
  const actions = new StubGameActions()
  const original = new Error('Recording press logging failed after input.')
  const log = new ActivityLogService({
    getRecentActivity: () => [],
    putActivity: entry => { if (entry.data.operation === 'press') throw original }
  })
  const service = new MacroService(new InMemoryMacroRepository(), new LoggedGameActions(actions, log))
  const recording = service.startRecording('desktop-client')

  await expect(service.recordAction(recording.id, {
    actionId: 'elite.PrimaryFire', clientId: 'desktop-client', operation: 'press'
  })).rejects.toBe(original)

  if (operation === 'stop') {
    await expect(service.stopRecording(recording.id, 'desktop-client')).resolves.toMatchObject({
      entries: [], status: 'stopped'
    })
  } else {
    await service.cancelRecording(recording.id, 'desktop-client')
  }
  expect(actions.calls.map(call => call.operation)).toEqual(['press', 'release'])
  expect(actions.calls[1]?.leaseId).toBe(actions.calls[0]?.leaseId)
  await expect(service.stopRecording(recording.id, 'desktop-client')).rejects.toThrow('session is unavailable')
})

test.each(['stop', 'cancel'] as const)('recording %s does not retry an explicit release whose post-input logging failed', async operation => {
  const actions = new StubGameActions()
  const original = new Error('Recording release logging failed after input.')
  const log = new ActivityLogService({
    getRecentActivity: () => [],
    putActivity: entry => { if (entry.data.operation === 'release') throw original }
  })
  const service = new MacroService(new InMemoryMacroRepository(), new LoggedGameActions(actions, log))
  const recording = service.startRecording('desktop-client')
  await service.recordAction(recording.id, {
    actionId: 'elite.PrimaryFire', clientId: 'desktop-client', operation: 'press'
  })
  await expect(service.recordAction(recording.id, {
    actionId: 'elite.PrimaryFire', clientId: 'desktop-client', operation: 'release'
  })).rejects.toBe(original)

  if (operation === 'stop') {
    await expect(service.stopRecording(recording.id, 'desktop-client')).resolves.toMatchObject({
      entries: [{ actionId: 'elite.PrimaryFire', operation: 'press', status: 'accepted' }], status: 'stopped'
    })
  } else {
    await service.cancelRecording(recording.id, 'desktop-client')
  }
  expect(actions.calls.map(call => call.operation)).toEqual(['press', 'release'])
  expect(actions.calls[1]?.leaseId).toBe(actions.calls[0]?.leaseId)
})

test('a late recording press result does not resurrect a lease consumed by an overlapping release', async () => {
  const actions = new StubGameActions()
  let finishPress!: () => void
  const pressResponse = new Promise<void>(resolve => { finishPress = resolve })
  const execute = vi.fn(async (candidate: unknown, origin: GameActionOrigin) => {
    const result = await actions.execute(candidate, origin)
    if (result.operation === 'press') await pressResponse
    return result
  })
  const service = new MacroService(new InMemoryMacroRepository(), { execute, getCatalog: () => actions.getCatalog() })
  const recording = service.startRecording('desktop-client')
  const press = service.recordAction(recording.id, {
    actionId: 'elite.PrimaryFire', clientId: 'desktop-client', operation: 'press'
  })
  await service.recordAction(recording.id, {
    actionId: 'elite.PrimaryFire', clientId: 'desktop-client', operation: 'release'
  })
  finishPress()
  await press
  await service.stopRecording(recording.id, 'desktop-client')

  expect(actions.calls.map(call => call.operation)).toEqual(['press', 'release'])
  expect(actions.calls[1]?.leaseId).toBe(actions.calls[0]?.leaseId)
})

test.each(['stop', 'cancel'] as const)('a late recording press result after %s cannot restart its hold renewal', async operation => {
  const actions = new StubGameActions()
  let finishPress!: () => void
  const pressResponse = new Promise<void>(resolve => { finishPress = resolve })
  const execute = async (candidate: unknown, origin: GameActionOrigin) => {
    const result = await actions.execute(candidate, origin)
    if (result.operation === 'press') await pressResponse
    return result
  }
  const renew = vi.spyOn(globalThis, 'setInterval')
  try {
    const service = new MacroService(new InMemoryMacroRepository(), { execute, getCatalog: () => actions.getCatalog() })
    const recording = service.startRecording('desktop-client')
    const press = service.recordAction(recording.id, {
      actionId: 'elite.PrimaryFire', clientId: 'desktop-client', operation: 'press'
    })
    if (operation === 'stop') await service.stopRecording(recording.id, 'desktop-client')
    else await service.cancelRecording(recording.id, 'desktop-client')
    finishPress()
    await press

    expect(actions.calls.map(call => call.operation)).toEqual(['press', 'release'])
    expect(actions.calls[1]?.leaseId).toBe(actions.calls[0]?.leaseId)
    expect(renew).not.toHaveBeenCalled()
  } finally { renew.mockRestore() }
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
