import { randomUUID } from 'node:crypto'
import type { EliteInventoryFileSnapshot, GameEventEnvelope } from '@phoenix/contracts'
import type { GameEventIngestor } from '../domain/runtime-state.js'

export class EliteInventoryIngestionService {
  public constructor (private readonly events: GameEventIngestor) {}

  public ingest (snapshot: EliteInventoryFileSnapshot): GameEventEnvelope {
    const type = {
      cargo: 'inventory.cargo_changed',
      ship_locker: 'inventory.ship_locker_changed',
      backpack: 'inventory.backpack_changed'
    } as const
    return this.events.ingest({
      schemaVersion: 1,
      id: randomUUID(),
      type: type[snapshot.kind],
      gameTimestamp: snapshot.payload.updatedAt,
      ingestedAt: new Date().toISOString(),
      source: 'state_file',
      payload: snapshot.payload
    } as GameEventEnvelope)
  }
}
