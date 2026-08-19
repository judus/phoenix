import type {
  CommandCatalogueSnapshot,
  CommandExecutionResult,
  CommandDescriptor,
  ExecuteCommandRequest
} from './commands.js'
import type { ControlGridLayout } from './layouts.js'
import type { MacroDefinition, MacroLibrary } from './macros.js'

export interface CommandCataloguePort {
  find(commandId: string): CommandDescriptor | undefined
  getSnapshot(): CommandCatalogueSnapshot
  subscribe(listener: (snapshot: CommandCatalogueSnapshot) => void): () => void
}

export interface CommandExecutor {
  execute(
    request: ExecuteCommandRequest,
    origin: string,
    signal?: AbortSignal
  ): Promise<CommandExecutionResult>
}

export interface ControlGridLayoutRepository {
  getLayout(): ControlGridLayout
  saveLayout(layout: ControlGridLayout): ControlGridLayout
}

export interface MacroRepository {
  delete(id: string): void
  get(id: string): MacroDefinition | undefined
  getLibrary(): MacroLibrary
  save(definition: MacroDefinition): MacroDefinition
}
