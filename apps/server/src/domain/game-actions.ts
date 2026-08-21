import type {
  GameActionCatalogResponse,
  GameActionCommand,
  GameActionResult
} from '@phoenix/contracts'

export interface GameActionGateway {
  execute(command: GameActionCommand, signal?: AbortSignal): Promise<GameActionResult>
  getCatalog(): GameActionCatalogResponse
}
