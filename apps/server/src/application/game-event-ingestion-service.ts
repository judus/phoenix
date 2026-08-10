import {
  GameEventEnvelopeSchema,
  type GameEventEnvelope
} from '@phoenix/contracts'
import type { Publisher } from '../domain/publisher.js'
import type { GameEventIngestor } from '../domain/runtime-state.js'

export class GameEventIngestionService implements GameEventIngestor {
  public constructor (private readonly events: Publisher<GameEventEnvelope>) {}

  public ingest (candidate: unknown): GameEventEnvelope {
    const event = GameEventEnvelopeSchema.parse(candidate)
    this.events.publish(event)
    return event
  }
}
