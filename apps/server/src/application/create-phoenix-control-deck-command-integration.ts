import type { RuntimeState } from '@phoenix/contracts'
import type { ControlDeckCommandIntegration } from 'control-deck/host'
import type { Commands } from '../domain/commands.js'
import type { RuntimeStateReader } from '../domain/runtime-state.js'
import type { Subscribable } from '../domain/publisher.js'
import type { GameActions } from './game-action-service.js'
import { PhoenixControlDeckCommandAdapter } from './phoenix-control-deck-command-adapter.js'
import { PhoenixControlDeckCommandStateProvider } from './phoenix-control-deck-command-state-provider.js'

/** Builds PHOENIX's command catalogue, executor, and matching telemetry-state source as one unit. */
export function createPhoenixControlDeckCommandIntegration (
  commands: Commands,
  gameActions: GameActions,
  runtimeState: RuntimeStateReader,
  runtimeStateUpdates: Subscribable<RuntimeState>
): ControlDeckCommandIntegration {
  return {
    commandAdapter: new PhoenixControlDeckCommandAdapter(commands, gameActions),
    stateProvider: new PhoenixControlDeckCommandStateProvider(gameActions, runtimeState, runtimeStateUpdates)
  }
}
