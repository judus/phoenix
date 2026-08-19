import type { ControlDeckCommandOperation } from '@jdu/control-deck-core'
import type { KeyboardCommandConfiguration, KeyboardOutput, KeyboardOutputStatus } from './keyboard-command-adapter.js'

export interface RecordedKeyboardInput {
  configuration: KeyboardCommandConfiguration
  operation: ControlDeckCommandOperation
}

export class RecordingKeyboardOutput implements KeyboardOutput {
  private readonly inputs: RecordedKeyboardInput[] = []

  public getStatus (): KeyboardOutputStatus {
    return {
      available: true,
      detail: 'Recording keyboard output is available for diagnostics.',
      platformRequirements: [],
      simulated: true
    }
  }

  public async send (
    operation: ControlDeckCommandOperation,
    configuration: KeyboardCommandConfiguration,
    signal: AbortSignal
  ): Promise<void> {
    signal.throwIfAborted()
    this.inputs.push({
      operation,
      configuration: { key: configuration.key, modifiers: [...configuration.modifiers] }
    })
  }

  public getRecordedInputs (): RecordedKeyboardInput[] {
    return structuredClone(this.inputs)
  }
}
