import {
  RuntimeStateSchema,
  type GameEventEnvelope,
  type RuntimeState
} from '@phoenix/contracts'
import type { Publisher } from '../domain/publisher.js'
import type {
  RuntimeStateProjector,
  RuntimeStateReader,
  RuntimeStateWriter
} from '../domain/runtime-state.js'

export class DefaultRuntimeStateProjector implements RuntimeStateProjector {
  public constructor (
    private readonly store: RuntimeStateReader & RuntimeStateWriter,
    private readonly updates: Publisher<RuntimeState>
  ) {}

  public project (event: GameEventEnvelope): RuntimeState {
    const current = this.store.getCurrent()
    const next = RuntimeStateSchema.parse({
      ...current,
      revision: current.revision + 1,
      updatedAt: event.ingestedAt,
      commander: event.type === 'commander.identity_changed'
        ? { name: event.payload.name }
        : current.commander,
      location: event.type === 'location.changed'
        ? event.payload
        : current.location,
      ship: event.type === 'ship.identity_changed'
        ? event.payload
        : current.ship
    })

    this.store.replace(next)
    this.updates.publish(next)
    return next
  }
}
