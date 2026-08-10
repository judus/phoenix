import { randomUUID } from 'node:crypto'
import {
  EliteGameStatusSchema,
  type EliteGameStatus,
  type GameEventEnvelope
} from '@phoenix/contracts'
import type { GameEventIngestor } from '../domain/runtime-state.js'

export class EliteStatusIngestionService {
  public constructor (private readonly events: GameEventIngestor) {}

  public ingest (candidate: EliteGameStatus): GameEventEnvelope {
    const status = EliteGameStatusSchema.parse(candidate)
    return this.events.ingest({
      schemaVersion: 1,
      id: randomUUID(),
      type: 'game.status_changed',
      gameTimestamp: status.timestamp,
      ingestedAt: new Date().toISOString(),
      source: 'status',
      payload: status
    })
  }
}
