import type { GameActionOperation, InputBackendStatus, LogicalInputChord } from '@phoenix/contracts'
import {
  PersistentPowerShellWindowsSendInputRunner,
  WindowsSendInputKeyboardOutput,
  type WindowsInputEvent,
  type WindowsSendInputKeyboardOutputOptions,
  type WindowsSendInputRunner
} from '@jdu/control-deck-adapter-keyboard'
import type { InputBackend } from '../domain/game-actions.js'

export { PersistentPowerShellWindowsSendInputRunner }
export type { WindowsInputEvent, WindowsSendInputRunner }
export type WindowsSendInputBackendOptions = WindowsSendInputKeyboardOutputOptions

export class WindowsSendInputBackend implements InputBackend {
  private readonly output: WindowsSendInputKeyboardOutput

  public constructor (options: WindowsSendInputBackendOptions = {}) {
    this.output = new WindowsSendInputKeyboardOutput(options)
  }

  public getStatus (): InputBackendStatus {
    const status = this.output.getStatus()
    return { id: 'windows-sendinput', available: status.available, simulated: status.simulated, detail: status.detail }
  }

  public send (operation: GameActionOperation, binding: LogicalInputChord, signal?: AbortSignal): Promise<void> {
    return this.output.send(operation, { key: binding.key, modifiers: binding.modifiers }, signal)
  }

  public stop (): Promise<void> {
    return this.output.stop()
  }
}
