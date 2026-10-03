import type {
  CommandCatalogResponse,
  CommandCatalogueSnapshot,
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

export type CommandCatalogueChangeSource =
  | 'control-deck'
  | 'macros'
  | 'module-settings'
  | 'shortcuts'

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

export type NavigationCommandDestinations = readonly NavigationCommandDestination[] | (() => readonly NavigationCommandDestination[])

export function navigationDestinations (source: NavigationCommandDestinations): readonly NavigationCommandDestination[] {
  return typeof source === 'function' ? source() : source
}

export interface NavigationCommandExecutor {
  execute(
    destination: NavigationCommandDestination,
    operation: GameActionOperation
  ): Promise<{ href: string, message: string }>
}
