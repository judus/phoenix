import type {
  GameActionOperation,
  InputBackendStatus,
  LogicalInputChord
} from '@phoenix/contracts'
import type { InputBackend } from '../domain/game-actions.js'

export interface RecordedInput {
  binding: LogicalInputChord
  operation: GameActionOperation
}

export class RecordingInputBackend implements InputBackend {
  private readonly recordedInputs: RecordedInput[] = []

  public getStatus (): InputBackendStatus {
    return {
      id: 'recording',
      available: true,
      simulated: true,
      detail: 'Recording backend active; operating-system input is disabled.'
    }
  }

  public async send (operation: GameActionOperation, binding: LogicalInputChord): Promise<void> {
    this.recordedInputs.push({ operation, binding: structuredClone(binding) })
  }

  public getRecordedInputs (): RecordedInput[] {
    return structuredClone(this.recordedInputs)
  }
}
