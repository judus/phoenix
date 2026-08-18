import type {
  GameActionAvailability,
  GameActionCatalogResponse,
  GameActionCommand,
  GameActionDefinition,
  GameActionBindingSourceDiagnostics,
  GameActionOperation,
  GameActionResult,
  InputBackendStatus,
  LogicalInputChord,
  ResolvedGameActionBinding
} from '@phoenix/contracts'

export interface GameActionCatalog {
  find(actionId: string): GameActionDefinition | undefined
  list(): GameActionDefinition[]
}

export interface GameActionBindingResolver {
  resolve(eliteBinding: string): LogicalInputChord | null
  listBindings(): ResolvedGameActionBinding[]
  listCommands(): string[]
  getDiagnostics(): GameActionBindingSourceDiagnostics
}

export interface GameActionGateway {
  execute(command: GameActionCommand, signal?: AbortSignal): Promise<GameActionResult>
  getCatalog(): GameActionCatalogResponse
}

export interface InputBackend {
  getStatus(): InputBackendStatus
  send(operation: GameActionOperation, binding: LogicalInputChord, signal?: AbortSignal): Promise<void>
  stop?(): Promise<void> | void
}

export function getActionAvailability (
  definition: GameActionDefinition,
  binding: LogicalInputChord | null,
  backend: InputBackendStatus
): GameActionAvailability {
  const unavailableReason = !backend.available
    ? backend.detail
    : !binding
        ? `No keyboard binding is configured for ${definition.eliteBinding}.`
        : null

  return {
    definition,
    available: unavailableReason === null,
    binding,
    unavailableReason
  }
}
