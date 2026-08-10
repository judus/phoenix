import type {
  GameActionOperation,
  InputBackendStatus,
  LogicalInputChord
} from '@phoenix/contracts'
import type { InputBackend } from '../domain/game-actions.js'

export class UnavailableInputBackend implements InputBackend {
  public constructor (
    private readonly id: string,
    private readonly detail: string
  ) {}

  public getStatus (): InputBackendStatus {
    return {
      id: this.id,
      available: false,
      simulated: false,
      detail: this.detail
    }
  }

  public async send (_operation: GameActionOperation, _binding: LogicalInputChord): Promise<void> {
    throw new Error(this.detail)
  }
}
