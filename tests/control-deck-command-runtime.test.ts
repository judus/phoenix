import {
  CommandExecutionRuntime,
  type CommandExecutionAdapter,
  type CommandRuntimeRequest,
  type CommandRuntimeResult
} from '@jdu/control-deck-core'
import { expect, test } from 'vitest'

interface TestResult extends CommandRuntimeResult {
  message: string
  operation: 'tap' | 'press' | 'release'
}

class RecordingAdapter implements CommandExecutionAdapter<string, TestResult> {
  public readonly operations: string[] = []

  public createExpiredRelease (request: CommandRuntimeRequest<string>): CommandRuntimeRequest<string> {
    return { ...request, operation: 'release', requestId: `${request.requestId}-release` }
  }

  public createResult (
    request: CommandRuntimeRequest<string>,
    status: 'accepted' | 'rejected',
    message: string
  ): TestResult {
    return { message, operation: request.operation, status }
  }

  public async execute (request: CommandRuntimeRequest<string>): Promise<TestResult> {
    this.operations.push(request.operation)
    return { message: 'executed', operation: request.operation, status: 'accepted' }
  }
}

test('generic command runtime owns hold renewal and shutdown cleanup', async () => {
  const adapter = new RecordingAdapter()
  const runtime = new CommandExecutionRuntime(adapter)
  const press = command('press', 'lease-1')

  expect(await runtime.execute(press)).toMatchObject({ status: 'accepted' })
  expect(await runtime.execute(press)).toMatchObject({ message: 'Hold lease renewed.' })
  expect(adapter.operations).toEqual(['press'])
  await runtime.stop()
  expect(adapter.operations).toEqual(['press', 'release'])
})

test('generic command runtime rejects a lease reused by another target', async () => {
  const adapter = new RecordingAdapter()
  const runtime = new CommandExecutionRuntime(adapter)
  await runtime.execute(command('press', 'lease-1'))

  const result = await runtime.execute({
    ...command('press', 'lease-1'),
    payload: 'other',
    targetKey: 'other'
  })

  expect(result).toMatchObject({ status: 'rejected', message: expect.stringContaining('different target') })
  await runtime.stop()
})

function command (
  operation: 'tap' | 'press' | 'release',
  leaseId?: string
): CommandRuntimeRequest<string> {
  return {
    correlationId: 'correlation-1',
    ...(leaseId ? { leaseId } : {}),
    operation,
    ownerKey: 'test',
    payload: 'button-1',
    requestId: 'request-1',
    targetKey: 'button-1'
  }
}
