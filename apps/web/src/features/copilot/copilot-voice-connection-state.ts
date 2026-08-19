import type { CopilotVoiceHostCommand } from '@phoenix/contracts'

export class CopilotVoiceConnectionState {
  private appliedCommandRevision = 0
  private connectionAttempt = 0
  private localIntentPending = false
  private minimumCommandRevision = 0

  public beginConnection (): number {
    this.connectionAttempt++
    return this.connectionAttempt
  }

  public cancelConnection (): void {
    this.connectionAttempt++
  }

  public isCurrentConnection (attempt: number): boolean {
    return attempt === this.connectionAttempt
  }

  public noteLocalIntent (currentCoordinatorRevision: number): void {
    this.localIntentPending = true
    this.minimumCommandRevision = Math.max(
      this.minimumCommandRevision,
      currentCoordinatorRevision + 1
    )
  }

  public acceptCommand (command: Pick<CopilotVoiceHostCommand, 'revision'>): boolean {
    if (this.localIntentPending) return false
    if (command.revision < this.minimumCommandRevision || command.revision <= this.appliedCommandRevision) {
      return false
    }
    this.appliedCommandRevision = command.revision
    this.minimumCommandRevision = command.revision
    return true
  }

  public confirmLocalIntent (command: Pick<CopilotVoiceHostCommand, 'revision'>): void {
    this.localIntentPending = false
    this.appliedCommandRevision = Math.max(this.appliedCommandRevision, command.revision)
    this.minimumCommandRevision = this.appliedCommandRevision
  }

  public get appliedRevision (): number {
    return this.appliedCommandRevision
  }
}
