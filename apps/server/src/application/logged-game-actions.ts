import type { GameActionCatalogResponse, GameActionOrigin, GameActionResult } from '@phoenix/contracts'
import type { ActivityLogService } from './activity-log-service.js'
import type { GameActions } from './game-action-service.js'

export class LoggedGameActions implements GameActions {
  public constructor (
    private readonly actions: GameActions,
    private readonly activityLog: ActivityLogService
  ) {}

  public getCatalog (): GameActionCatalogResponse {
    return this.actions.getCatalog()
  }

  public async execute (candidate: unknown, origin: GameActionOrigin, signal?: AbortSignal): Promise<GameActionResult> {
    const result = await this.actions.execute(candidate, origin, signal)
    this.activityLog.ingestAction(result)
    return result
  }
}
