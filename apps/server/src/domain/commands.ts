import type {
  CommandCatalogResponse,
  CommandCatalogueSnapshot,
  CommandDescriptor,
  CommandExecutionResult,
  CommandOperation,
  GameActionOrigin
} from '@phoenix/contracts'

export interface CommandRegistry {
  find(commandId: string): CommandDescriptor | undefined
  getCatalog(): CommandCatalogResponse
}

export type CommandCatalogueChangeSource =
  | 'control-layout'
  | 'macros'
  | 'module-settings'

export interface CommandCatalogueChange {
  source: CommandCatalogueChangeSource
}

export interface CommandCatalogueSnapshots extends CommandRegistry {
  getSnapshot(): CommandCatalogueSnapshot
  invalidate(change: CommandCatalogueChange): CommandCatalogueSnapshot
  subscribe(listener: (snapshot: CommandCatalogueSnapshot) => void): () => void
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
    operation: CommandOperation
  ): Promise<{ href: string, message: string }>
}
