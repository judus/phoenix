import {
  ExecuteGameActionRequestSchema,
  GameActionCatalogResponseSchema,
  GameActionResultSchema,
  type GameActionCatalogResponse,
  type GameActionResult
} from '@phoenix/contracts'
import type { GameActionGateway } from '../domain/game-actions.js'

export interface DeveloperActions {
  execute(candidate: unknown): Promise<GameActionResult>
  getCatalog(): GameActionCatalogResponse
}

export class DeveloperActionService implements DeveloperActions {
  public constructor (private readonly gateway: GameActionGateway) {}

  public getCatalog (): GameActionCatalogResponse {
    return GameActionCatalogResponseSchema.parse(this.gateway.getCatalog())
  }

  public async execute (candidate: unknown): Promise<GameActionResult> {
    const request = ExecuteGameActionRequestSchema.parse(candidate)
    return GameActionResultSchema.parse(await this.gateway.execute({
      ...request,
      origin: 'developer'
    }))
  }
}
