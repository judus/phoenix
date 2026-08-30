import type {
  ControlDeckCommandState,
  ControlDeckCommandStateProvider
} from 'control-deck/core'
import {
  PHOENIX_CONTROL_DECK_ADAPTER_ID,
  phoenixTargetToControlDeckTarget,
  type RuntimeState
} from '@phoenix/contracts'
import type { RuntimeStateReader } from '../domain/runtime-state.js'
import type { Subscribable } from '../domain/publisher.js'
import type { GameActions } from './game-action-service.js'
import { readRuntimeTelemetryFlag } from './runtime-telemetry.js'

/** Publishes PHOENIX telemetry as observed state for state-capable Control Deck commands. */
export class PhoenixControlDeckCommandStateProvider implements ControlDeckCommandStateProvider {
  public readonly adapterId = PHOENIX_CONTROL_DECK_ADAPTER_ID

  public constructor (
    private readonly actions: GameActions,
    private readonly runtimeState: RuntimeStateReader,
    private readonly updates: Subscribable<RuntimeState>
  ) {}

  public getCommandStates (): readonly ControlDeckCommandState[] {
    const state = this.runtimeState.getCurrent()
    const observedAt = state.updatedAt ?? undefined
    return this.actions.getCatalog().actions.flatMap(action => {
      const telemetryKey = action.definition.telemetryKey
      if (!telemetryKey) return []
      const value = readRuntimeTelemetryFlag(state, telemetryKey)
      if (value === undefined) return []
      return [{
        target: phoenixTargetToControlDeckTarget({ type: 'game-action', actionId: action.definition.id }),
        value,
        ...(observedAt ? { observedAt } : {})
      }]
    })
  }

  public subscribeCommandStates (listener: () => void): () => void {
    return this.updates.subscribe(listener)
  }
}
