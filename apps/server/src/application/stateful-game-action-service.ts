import { randomUUID } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'
import {
  GameActionResultSchema,
  type GameActionResult
} from '@phoenix/contracts'
import type { RuntimeStateReader } from '../domain/runtime-state.js'
import type { GameActions } from './game-action-service.js'

export interface SetGameSwitchRequest {
  actionId: string
  enabled: boolean
}

export class StatefulGameActionService {
  public constructor (
    private readonly actions: GameActions,
    private readonly runtimeState: RuntimeStateReader,
    private readonly confirmationTimeoutMs = 2_500,
    private readonly pollIntervalMs = 50
  ) {}

  public async setSwitch (
    request: SetGameSwitchRequest,
    signal?: AbortSignal
  ): Promise<GameActionResult> {
    const available = this.actions.getCatalog().actions.find(action => (
      action.definition.id === request.actionId
    ))
    if (!available) return this.result(request.actionId, 'rejected', `Unknown action: ${request.actionId}.`)
    const telemetryKey = available.definition.telemetryKey
    if (!telemetryKey) {
      return this.result(
        request.actionId,
        'rejected',
        `${available.definition.label} has no observable switch state.`
      )
    }

    const current = readTelemetryFlag(this.runtimeState, telemetryKey)
    if (current === request.enabled) {
      return this.result(
        request.actionId,
        'already_satisfied',
        `${available.definition.label} is already ${request.enabled ? 'on' : 'off'}.`
      )
    }

    const execution = await this.actions.execute({ actionId: request.actionId, operation: 'tap' }, 'copilot', signal)
    if (execution.status !== 'accepted') return execution
    const confirmed = await this.waitForState(telemetryKey, request.enabled, signal)
    return GameActionResultSchema.parse({
      ...execution,
      status: confirmed ? 'confirmed' : 'unconfirmed',
      message: confirmed
        ? `${available.definition.label} is now ${request.enabled ? 'on' : 'off'}.`
        : `${available.definition.label} input was accepted, but telemetry did not confirm the change.`
    })
  }

  private async waitForState (
    telemetryKey: string,
    expected: boolean,
    signal?: AbortSignal
  ): Promise<boolean> {
    const deadline = Date.now() + this.confirmationTimeoutMs
    while (Date.now() < deadline) {
      signal?.throwIfAborted()
      if (readTelemetryFlag(this.runtimeState, telemetryKey) === expected) return true
      await delay(Math.min(this.pollIntervalMs, Math.max(1, deadline - Date.now())), undefined, {
        ...(signal === undefined ? {} : { signal })
      })
    }
    return readTelemetryFlag(this.runtimeState, telemetryKey) === expected
  }

  private result (
    actionId: string,
    status: GameActionResult['status'],
    message: string
  ): GameActionResult {
    const requestId = randomUUID()
    return GameActionResultSchema.parse({
      requestId,
      correlationId: requestId,
      actionId,
      operation: 'tap',
      origin: 'copilot',
      status,
      timestamp: new Date().toISOString(),
      message
    })
  }
}

function readTelemetryFlag (runtimeState: RuntimeStateReader, key: string): boolean | undefined {
  const status = runtimeState.getCurrent().gameStatus
  if (!status) return undefined
  const flags: Record<string, unknown> = { ...status.flags, ...status.flags2 }
  return typeof flags[key] === 'boolean' ? flags[key] : undefined
}
