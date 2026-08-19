import { randomUUID } from 'node:crypto'
import type {
  CopilotVoiceHostCommand,
  CopilotVoiceHostHeartbeat,
  CopilotVoiceHostSnapshot
} from '@phoenix/contracts'
import type { Unsubscribe } from '../domain/publisher.js'

export interface CopilotVoiceHostControl {
  heartbeat(input: CopilotVoiceHostHeartbeat): CopilotVoiceHostSnapshot
  release(hostId: string): CopilotVoiceHostSnapshot
  request(desiredConnected: boolean): CopilotVoiceHostCommand
  snapshot(): CopilotVoiceHostSnapshot
  subscribeCommands(listener: (command: CopilotVoiceHostCommand) => void): Unsubscribe
  subscribeStatus(listener: (snapshot: CopilotVoiceHostSnapshot) => void): Unsubscribe
}

export class CopilotVoiceHostCoordinator implements CopilotVoiceHostControl {
  private host?: CopilotVoiceHostSnapshot['host']
  private desiredConnected = false
  private desiredRevision = 0
  private awaitingDesiredState = false
  private readonly commandListeners = new Set<(command: CopilotVoiceHostCommand) => void>()
  private readonly statusListeners = new Set<(snapshot: CopilotVoiceHostSnapshot) => void>()
  private expiryTimer?: ReturnType<typeof setTimeout>

  public constructor (
    private readonly leaseMilliseconds = 30_000,
    private readonly now: () => Date = () => new Date()
  ) {}

  public heartbeat (input: CopilotVoiceHostHeartbeat): CopilotVoiceHostSnapshot {
    const previousHostId = this.activeHost()?.hostId
    this.host = { ...input, lastSeenAt: this.now().toISOString() }
    this.scheduleExpiry(input.hostId)
    if (previousHostId !== input.hostId) {
      this.desiredConnected = input.connected
      this.desiredRevision = input.appliedRevision
      this.awaitingDesiredState = false
    } else if (this.awaitingDesiredState && input.appliedRevision >= this.desiredRevision) {
      this.awaitingDesiredState = false
    } else if (!this.awaitingDesiredState && input.appliedRevision >= this.desiredRevision) {
      this.desiredConnected = input.connected
    }
    const snapshot = this.snapshot()
    this.publishStatus(snapshot)
    return snapshot
  }

  public release (hostId: string): CopilotVoiceHostSnapshot {
    if (this.activeHost()?.hostId === hostId) {
      this.host = undefined
      this.desiredConnected = false
      this.desiredRevision = 0
      this.awaitingDesiredState = false
      this.clearExpiry()
      this.publishStatus(this.snapshot())
    }
    return this.snapshot()
  }

  public request (desiredConnected: boolean): CopilotVoiceHostCommand {
    const host = this.activeHost()
    if (!host) throw new Error('No armed desktop voice host is online.')
    this.desiredConnected = desiredConnected
    this.desiredRevision++
    this.awaitingDesiredState = true
    const command: CopilotVoiceHostCommand = {
      desiredConnected,
      hostId: host.hostId,
      issuedAt: this.now().toISOString(),
      requestId: randomUUID(),
      revision: this.desiredRevision
    }
    for (const listener of this.commandListeners) listener(command)
    this.publishStatus(this.snapshot())
    return command
  }

  public snapshot (): CopilotVoiceHostSnapshot {
    const host = this.activeHost() ?? null
    return {
      desiredConnected: this.desiredConnected,
      desiredRevision: this.desiredRevision,
      host
    }
  }

  public subscribeCommands (listener: (command: CopilotVoiceHostCommand) => void): Unsubscribe {
    this.commandListeners.add(listener)
    return () => this.commandListeners.delete(listener)
  }

  public subscribeStatus (listener: (snapshot: CopilotVoiceHostSnapshot) => void): Unsubscribe {
    this.statusListeners.add(listener)
    return () => this.statusListeners.delete(listener)
  }

  private activeHost (): CopilotVoiceHostSnapshot['host'] | undefined {
    if (!this.host) return undefined
    if (this.now().getTime() - Date.parse(this.host.lastSeenAt) <= this.leaseMilliseconds) return this.host
    this.host = undefined
    this.desiredConnected = false
    this.desiredRevision = 0
    this.awaitingDesiredState = false
    return undefined
  }

  private publishStatus (snapshot: CopilotVoiceHostSnapshot): void {
    for (const listener of this.statusListeners) listener(snapshot)
  }

  private scheduleExpiry (hostId: string): void {
    this.clearExpiry()
    this.expiryTimer = setTimeout(() => {
      if (this.host?.hostId !== hostId) return
      this.host = undefined
      this.desiredConnected = false
      this.desiredRevision = 0
      this.awaitingDesiredState = false
      this.publishStatus(this.snapshot())
    }, this.leaseMilliseconds + 10)
    this.expiryTimer.unref?.()
  }

  private clearExpiry (): void {
    if (this.expiryTimer) clearTimeout(this.expiryTimer)
    this.expiryTimer = undefined
  }
}
