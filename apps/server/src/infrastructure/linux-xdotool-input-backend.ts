import type { GameActionOperation, InputBackendStatus, LogicalInputChord } from '@phoenix/contracts'
import {
  LinuxXdotoolKeyboardOutput,
  type LinuxXdotoolKeyboardOutputOptions,
  type XdotoolCommandRunner
} from '@jdu/control-deck-adapter-keyboard'
import type { InputBackend } from '../domain/game-actions.js'

export type { XdotoolCommandRunner }
export type LinuxXdotoolInputBackendOptions = LinuxXdotoolKeyboardOutputOptions

export class LinuxXdotoolInputBackend implements InputBackend {
  private readonly output: LinuxXdotoolKeyboardOutput

  public constructor (options: LinuxXdotoolInputBackendOptions = {}) {
    this.output = new LinuxXdotoolKeyboardOutput(options)
  }

  public getStatus (): InputBackendStatus {
    const status = this.output.getStatus()
    return { id: 'linux-xdotool', available: status.available, simulated: status.simulated, detail: status.detail }
  }

  public send (operation: GameActionOperation, binding: LogicalInputChord, signal?: AbortSignal): Promise<void> {
    return this.output.send(operation, { key: binding.key, modifiers: binding.modifiers }, signal)
  }
}
