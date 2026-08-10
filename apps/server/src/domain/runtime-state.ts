import type { GameEventEnvelope, RuntimeState } from '@phoenix/contracts'

export interface GameEventIngestor {
  ingest(candidate: unknown): GameEventEnvelope
}

export interface RuntimeStateProjector {
  project(event: GameEventEnvelope): RuntimeState
}

export interface RuntimeStateReader {
  getCurrent(): RuntimeState
}

export interface RuntimeStateWriter {
  replace(state: RuntimeState): void
}
