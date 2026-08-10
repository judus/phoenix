import {
  ExecuteGameActionRequestSchema,
  GameActionCatalogResponseSchema,
  GameActionOriginSchema,
  GameActionResultSchema,
  type GameActionCatalogResponse,
  type GameActionOrigin,
  type GameActionResult
} from '@phoenix/contracts'
import type { GameActionGateway } from '../domain/game-actions.js'

export interface GameActions {
  execute(candidate: unknown, origin: GameActionOrigin): Promise<GameActionResult>
  getCatalog(): GameActionCatalogResponse
}

export class GameActionService implements GameActions {
  public constructor (private readonly gateway: GameActionGateway) {}

  public getCatalog (): GameActionCatalogResponse {
    return GameActionCatalogResponseSchema.parse(this.gateway.getCatalog())
  }

  public async execute (candidate: unknown, originCandidate: GameActionOrigin): Promise<GameActionResult> {
    const request = ExecuteGameActionRequestSchema.parse(candidate)
    const origin = GameActionOriginSchema.parse(originCandidate)
    return GameActionResultSchema.parse(await this.gateway.execute({ ...request, origin }))
  }
}
