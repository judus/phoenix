import { expect, test } from 'vitest'
import type { GameEventEnvelope, RuntimeState } from '@phoenix/contracts'
import { DefaultRuntimeStateProjector } from '../apps/server/src/application/default-runtime-state-projector.js'
import { GameEventIngestionService } from '../apps/server/src/application/game-event-ingestion-service.js'
import { InMemoryRuntimeStateStore } from '../apps/server/src/infrastructure/in-memory-runtime-state-store.js'
import { InProcessPublisher } from '../apps/server/src/infrastructure/in-process-publisher.js'

test('validated game events update and publish the runtime snapshot', () => {
  const gameEvents = new InProcessPublisher<GameEventEnvelope>()
  const stateUpdates = new InProcessPublisher<RuntimeState>()
  const store = new InMemoryRuntimeStateStore()
  const projector = new DefaultRuntimeStateProjector(store, stateUpdates)
  const ingestion = new GameEventIngestionService(gameEvents)
  const published: RuntimeState[] = []
  gameEvents.subscribe(event => projector.project(event))
  stateUpdates.subscribe(state => published.push(state))

  ingestion.ingest({
    schemaVersion: 1,
    id: 'synthetic-location-1',
    type: 'location.changed',
    gameTimestamp: '2026-08-10T12:00:00.000Z',
    ingestedAt: '2026-08-10T12:00:01.000Z',
      source: 'synthetic',
      payload: {
        state: 'docked',
        place: {
          kind: 'station',
          name: 'Galileo',
          type: 'Orbis',
          marketId: 1,
          faction: null,
          government: null,
          primaryEconomy: null,
          economies: [],
          services: []
        }
    }
  })

  expect(store.getCurrent()).toMatchObject({
    revision: 1,
    updatedAt: '2026-08-10T12:00:01.000Z',
    location: {
      state: 'docked',
      place: { kind: 'station', name: 'Galileo' }
    }
  })
  expect(published).toHaveLength(1)
})

test('invalid events are rejected before publication', () => {
  const gameEvents = new InProcessPublisher<GameEventEnvelope>()
  const ingestion = new GameEventIngestionService(gameEvents)
  let publications = 0
  gameEvents.subscribe(() => publications++)

  expect(() => ingestion.ingest({
    schemaVersion: 1,
    id: 'invalid-location',
    type: 'location.changed',
    gameTimestamp: null,
    ingestedAt: 'not-a-timestamp',
    source: 'synthetic',
    payload: {}
  })).toThrow()
  expect(publications).toBe(0)
})
