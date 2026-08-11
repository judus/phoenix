import { expect, test } from 'vitest'
import { createEmptyRuntimeState, type GameEventEnvelope } from '@phoenix/contracts'
import { EliteJournalIngestionService } from '../apps/server/src/application/elite-journal-ingestion-service.js'
import type { GameEventIngestor } from '../apps/server/src/domain/runtime-state.js'
import { PhoenixApplication } from '../apps/server/src/phoenix-application.js'
import { PhoenixApiClient } from '../apps/web/src/api/phoenix-api-client.js'

test('engineering APIs combine the imported catalogue with live commander state', async () => {
  const application = new PhoenixApplication({
    databasePath: ':memory:',
    eliteDirectory: null,
    host: '127.0.0.1',
    port: 0
  })
  const address = await application.start()
  const empty = createEmptyRuntimeState()

  try {
    application.ingestGameEvent(envelope('commander.engineers_changed', [{
      id: 300000,
      name: 'Didi Vatermann',
      status: 'Unlocked',
      rank: 4,
      rankProgress: 73
    }]))
    application.ingestGameEvent(envelope('system.changed', {
      ...empty.system,
      name: 'Sol',
      position: [0, 0, 0]
    }))
    application.ingestGameEvent(envelope('inventory.materials_changed', {
      updatedAt: '2026-08-11T20:00:00.000Z',
      raw: [],
      manufactured: [{ id: 'WornShieldEmitters', label: 'Worn Shield Emitters', count: 7 }],
      encoded: []
    }))
    application.ingestGameEvent(envelope('inventory.material_consumed', {
      updatedAt: '2026-08-11T20:01:00.000Z',
      id: 'WornShieldEmitters',
      label: 'Worn Shield Emitters',
      count: 2
    }))
    const api = new PhoenixApiClient(`http://${address.host}:${address.port}`)
    const engineers = await api.getEngineeringEngineers()
    const materials = await api.getEngineeringMaterials('manufactured')
    const blueprints = await api.getEngineeringBlueprints()
    const blueprint = await api.getEngineeringBlueprint('AFM_Shielded')

    expect(engineers.engineers).toHaveLength(38)
    expect(engineers.engineers.find(engineer => engineer.name === 'Didi Vatermann')).toMatchObject({
      state: 'unlocked',
      progress: { rank: 4, rankProgress: 73, status: 'Unlocked' },
      system: { name: 'Leesti' }
    })
    expect(materials.materials.find(material => material.id === 'WornShieldEmitters')).toMatchObject({
      count: 5,
      maxCount: 300,
      grade: 1,
      group: 'Shielding'
    })
    expect(blueprints.blueprints).toHaveLength(80)
    expect(blueprint.symbol).toBe('AFM_Shielded')
    expect(blueprint.grades[0]).toMatchObject({
      grade: 1,
      components: [{ name: 'Worn Shield Emitters', count: 5, cost: 1 }]
    })
  } finally {
    await application.stop()
  }
})

test('EngineerProgress journal events become typed commander state events', () => {
  const events: GameEventEnvelope[] = []
  const ingestor: GameEventIngestor = {
    ingest: candidate => {
      const event = candidate as GameEventEnvelope
      events.push(event)
      return event
    }
  }
  const service = new EliteJournalIngestionService(ingestor)
  service.ingest({
    timestamp: '2026-08-11T20:00:00Z',
    event: 'EngineerProgress',
    Engineers: [{ Engineer: 'Didi Vatermann', EngineerID: 300000, Progress: 'Unlocked', Rank: 4, RankProgress: 73 }]
  })
  service.ingest({
    timestamp: '2026-08-11T20:01:00Z',
    event: 'EngineerCraft',
    Ingredients: [{ Name: 'WornShieldEmitters', Name_Localised: 'Worn Shield Emitters', Count: 2 }]
  })

  expect(events).toEqual([
    expect.objectContaining({
      type: 'commander.engineers_changed',
      payload: [{ id: 300000, name: 'Didi Vatermann', status: 'Unlocked', rank: 4, rankProgress: 73 }]
    }),
    expect.objectContaining({
      type: 'inventory.material_consumed',
      payload: expect.objectContaining({ id: 'WornShieldEmitters', label: 'Worn Shield Emitters', count: 2 })
    })
  ])
})

function envelope<T extends GameEventEnvelope['type']> (
  type: T,
  payload: Extract<GameEventEnvelope, { type: T }>['payload']
): Extract<GameEventEnvelope, { type: T }> {
  return {
    schemaVersion: 1,
    id: `test-${type}`,
    ingestedAt: '2026-08-11T20:00:00.000Z',
    gameTimestamp: '2026-08-11T20:00:00.000Z',
    source: 'synthetic',
    type,
    payload
  } as Extract<GameEventEnvelope, { type: T }>
}
