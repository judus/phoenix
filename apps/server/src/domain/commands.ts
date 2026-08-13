import type {
  CommandCatalogResponse,
  CommandDescriptor,
  CommandExecutionResult,
  CommandTarget,
  GameActionOperation,
  GameActionOrigin
} from '@phoenix/contracts'

export interface CommandRegistry {
  find(target: CommandTarget): CommandDescriptor | undefined
  getCatalog(): CommandCatalogResponse
}

export interface Commands {
  execute(
    candidate: unknown,
    origin: GameActionOrigin,
    signal?: AbortSignal
  ): Promise<CommandExecutionResult>
  getCatalog(): CommandCatalogResponse
}

export interface NavigationCommandDestination {
  category: string
  description: string
  href: string
  id: string
  label: string
  risk?: CommandDescriptor['risk']
}

export interface NavigationCommandExecutor {
  execute(
    destination: NavigationCommandDestination,
    operation: GameActionOperation
  ): Promise<{ href: string, message: string }>
}
