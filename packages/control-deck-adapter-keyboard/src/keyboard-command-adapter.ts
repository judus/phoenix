import type {
  ControlDeckAdapterDescriptor,
  ControlDeckAdapterExecutionResult,
  ControlDeckCommandAdapter,
  ControlDeckCommandInvocation,
  ControlDeckCommandOperation,
  ControlDeckCommandTarget
} from '@jdu/control-deck-core'

export interface KeyboardCommandConfiguration {
  key: string
  modifiers: string[]
}

export interface KeyboardOutputStatus {
  available: boolean
  detail: string
  platformRequirements: string[]
  simulated: boolean
}

export interface KeyboardOutput {
  getStatus(): KeyboardOutputStatus
  send(
    operation: ControlDeckCommandOperation,
    configuration: KeyboardCommandConfiguration,
    signal: AbortSignal
  ): Promise<void>
  start?(): Promise<void> | void
  stop?(): Promise<void> | void
}

export class KeyboardCommandAdapter implements ControlDeckCommandAdapter {
  public constructor (private readonly output: KeyboardOutput) {}

  public describe (): ControlDeckAdapterDescriptor {
    const status = this.output.getStatus()
    return {
      id: 'builtin.keyboard',
      version: '1',
      label: 'Keyboard',
      available: status.available,
      simulated: status.simulated,
      detail: status.detail,
      platformRequirements: status.platformRequirements,
      holdOwner: 'control-deck',
      commands: [{
        id: 'key',
        label: 'Keyboard key',
        description: 'Send a keyboard key or key chord to the configured target application.',
        category: 'Keyboard',
        available: status.available,
        unavailableReason: status.available ? null : status.detail,
        risk: 'safe',
        simulated: status.simulated,
        operations: ['tap', 'press', 'release'],
        configurationSchema: {
          type: 'object',
          additionalProperties: false,
          required: ['key'],
          properties: {
            key: { type: 'string', minLength: 1, maxLength: 64 },
            modifiers: {
              type: 'array',
              maxItems: 4,
              items: { type: 'string', minLength: 1, maxLength: 32 }
            }
          }
        }
      }]
    }
  }

  public validate (target: ControlDeckCommandTarget): string | null {
    if (target.adapterId !== 'builtin.keyboard' || target.commandId !== 'key') {
      return 'Unsupported keyboard command target.'
    }
    const key = target.configuration.key
    if (typeof key !== 'string' || key.trim() === '' || key.length > 64) {
      return 'Keyboard configuration requires a key of at most 64 characters.'
    }
    const modifiers = target.configuration.modifiers
    if (modifiers !== undefined && (!Array.isArray(modifiers) || modifiers.length > 4 ||
        modifiers.some(value => typeof value !== 'string' || value.trim() === '' || value.length > 32))) {
      return 'Keyboard modifiers must be an array of at most four names.'
    }
    return null
  }

  public async execute (
    invocation: ControlDeckCommandInvocation,
    signal: AbortSignal
  ): Promise<ControlDeckAdapterExecutionResult> {
    const { operation, target } = invocation
    const configuration: KeyboardCommandConfiguration = {
      key: target.configuration.key as string,
      modifiers: target.configuration.modifiers as string[] | undefined ?? []
    }
    const status = this.output.getStatus()
    try {
      signal.throwIfAborted()
      await this.output.send(operation, configuration, signal)
      return {
        status: 'accepted',
        message: status.simulated
          ? 'Keyboard input accepted. Simulation only; no operating-system input was sent.'
          : 'Keyboard input accepted.'
      }
    } catch (cause) {
      if (signal.aborted) {
        const timedOut = signal.reason instanceof DOMException && signal.reason.name === 'TimeoutError'
        return {
          status: timedOut ? 'timed_out' : 'cancelled',
          message: timedOut ? 'Keyboard input timed out.' : 'Keyboard input was cancelled.'
        }
      }
      return {
        status: 'failed',
        message: `Keyboard input failed: ${cause instanceof Error ? cause.message : 'Unknown output failure.'}`
      }
    }
  }

  public start (): Promise<void> | void {
    return this.output.start?.()
  }

  public stop (): Promise<void> | void {
    return this.output.stop?.()
  }
}
