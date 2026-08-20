import { expect, test, vi } from 'vitest'
import {
  ControlDeckMacroCommandAdapter,
  ControlDeckMacroDefinitionSchema,
  ControlDeckMacroLibrarySchema,
  type ControlDeckAdapterCommand,
  type ControlDeckCommandExecutionResult,
  type ControlDeckCommandTarget,
  type ControlDeckMacroDefinition,
  type ControlDeckMacroRepository
} from '@jdu/control-deck-core'

const keyboard = (key: string): ControlDeckCommandTarget => ({
  adapterId: 'builtin.keyboard',
  commandId: 'key',
  configuration: { key, modifiers: [] }
})

test('macro playback executes generic command targets and explicit waits', async () => {
  const repository = new MemoryMacroRepository([macro('launch', [
    { type: 'command', target: keyboard('A'), operation: 'tap' },
    { type: 'wait', durationMs: 1 },
    { type: 'command', target: keyboard('B'), operation: 'tap' }
  ])])
  const requests: Array<{ target: ControlDeckCommandTarget, operation: string }> = []
  const adapter = createAdapter(repository, async request => {
    requests.push(request)
    return result(request.target, request.operation)
  })

  const playback = await adapter.execute(invocation('launch'), new AbortController().signal)

  expect(playback).toMatchObject({ status: 'accepted', message: expect.stringContaining('outcomes are not confirmed') })
  expect(requests.map(request => [request.target.configuration.key, request.operation])).toEqual([
    ['A', 'tap'],
    ['B', 'tap']
  ])
})

test('macro failure releases every command still held', async () => {
  const repository = new MemoryMacroRepository([macro('hold_then_fail', [
    { type: 'command', target: keyboard('Z'), operation: 'press' },
    { type: 'command', target: keyboard('X'), operation: 'tap' }
  ])])
  const operations: string[] = []
  const adapter = createAdapter(repository, async request => {
    operations.push(`${request.target.configuration.key}:${request.operation}`)
    return result(request.target, request.operation, request.target.configuration.key === 'X' ? 'failed' : 'accepted')
  })

  const playback = await adapter.execute(invocation('hold_then_fail'), new AbortController().signal)

  expect(playback.status).toBe('failed')
  expect(operations).toEqual(['Z:press', 'X:tap', 'Z:release'])
})

test('active macro playback can be cancelled during a wait', async () => {
  const repository = new MemoryMacroRepository([macro('waiting', [{ type: 'wait', durationMs: 30_000 }])])
  const adapter = createAdapter(repository, async request => result(request.target, request.operation))

  const execution = adapter.execute(invocation('waiting'), new AbortController().signal)
  expect(adapter.getPlayback()).toMatchObject({ macroId: 'waiting', status: 'running' })
  expect(adapter.abortPlayback()).toMatchObject({ macroId: 'waiting' })

  await expect(execution).resolves.toMatchObject({ status: 'cancelled' })
  expect(adapter.getPlayback()).toBeNull()
})

test('macro catalogue derives risk and rejects nested macros', () => {
  const repository = new MemoryMacroRepository([
    macro('danger', [{ type: 'command', target: keyboard('Delete'), operation: 'tap' }]),
    macro('nested', [{ type: 'command', target: { adapterId: 'builtin.macro', commandId: 'danger', configuration: {} }, operation: 'tap' }])
  ])
  const adapter = new ControlDeckMacroCommandAdapter(repository, {
    createId: () => 'run',
    executor: { execute: async request => result(request.target, request.operation) },
    resolveCommand: target => target.adapterId === 'builtin.keyboard' ? command('destructive') : null
  })

  expect(adapter.describe().commands.find(candidate => candidate.id === 'danger')).toMatchObject({ risk: 'destructive', available: true })
  expect(adapter.describe().commands.find(candidate => candidate.id === 'nested')).toMatchObject({ available: false, unavailableReason: expect.stringContaining('cannot invoke another macro') })
})

function createAdapter (
  repository: ControlDeckMacroRepository,
  execute: (request: { target: ControlDeckCommandTarget, operation: 'tap' | 'press' | 'release', leaseId?: string }) => Promise<ControlDeckCommandExecutionResult>
) {
  let id = 0
  return new ControlDeckMacroCommandAdapter(repository, {
    createId: () => `id_${++id}`,
    executor: { execute },
    renewalMs: 60_000,
    resolveCommand: target => target.adapterId === 'builtin.keyboard' ? command('safe') : null
  })
}

function macro (id: string, steps: ControlDeckMacroDefinition['steps']): ControlDeckMacroDefinition {
  return ControlDeckMacroDefinitionSchema.parse({ version: 1, id, name: id, description: '', enabled: true, steps })
}

function command (risk: ControlDeckAdapterCommand['risk']): ControlDeckAdapterCommand {
  return {
    id: 'key',
    label: 'Keyboard key',
    description: 'Keyboard command',
    category: 'Keyboard',
    available: true,
    unavailableReason: null,
    risk,
    simulated: false,
    operations: ['tap', 'press', 'release'],
    configurationSchema: {}
  }
}

function invocation (macroId: string) {
  return {
    correlationId: 'correlation',
    operation: 'tap' as const,
    ownerKey: 'session:test',
    requestId: 'request',
    target: { adapterId: 'builtin.macro', commandId: macroId, configuration: {} }
  }
}

function result (
  target: ControlDeckCommandTarget,
  operation: 'tap' | 'press' | 'release',
  status: ControlDeckCommandExecutionResult['status'] = 'accepted'
): ControlDeckCommandExecutionResult {
  return {
    requestId: 'request',
    correlationId: 'correlation',
    target,
    operation,
    ownerKey: 'macro',
    status,
    timestamp: '2026-08-20T00:00:00.000Z',
    message: status === 'failed' ? 'Injected failure.' : 'Accepted.',
    simulated: false
  }
}

class MemoryMacroRepository implements ControlDeckMacroRepository {
  private readonly macros = new Map<string, ControlDeckMacroDefinition>()

  public constructor (macros: ControlDeckMacroDefinition[]) {
    for (const macro of macros) this.macros.set(macro.id, macro)
  }

  public delete (id: string): void { this.macros.delete(id) }
  public get (id: string): ControlDeckMacroDefinition | null { return this.macros.get(id) ?? null }
  public getLibrary () { return ControlDeckMacroLibrarySchema.parse({ version: 1, macros: [...this.macros.values()] }) }
  public save (candidate: ControlDeckMacroDefinition) {
    const saved = ControlDeckMacroDefinitionSchema.parse(candidate)
    this.macros.set(saved.id, saved)
    return saved
  }
}
