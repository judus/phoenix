import { expect, test } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createEmptyRuntimeState, type GameEventEnvelope } from '@phoenix/contracts'
import { EliteJournalIngestionService } from '../apps/server/src/application/elite-journal-ingestion-service.js'
import type { GameEventIngestor } from '../apps/server/src/domain/runtime-state.js'
import { PhoenixApplication } from '../apps/server/src/phoenix-application.js'
import { PhoenixApiClient } from '../apps/web/src/platform/api/phoenix-api-client.js'

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
      id: 900001,
      name: 'Ada Fixture',
      status: 'Unlocked',
      rank: 4,
      rankProgress: 73
    }]))
    application.ingestGameEvent(envelope('commander.engineer_progress_changed', {
      id: 900001,
      name: 'Ada Fixture',
      status: 'Unlocked',
      rank: 5,
      rankProgress: 0
    }))
    application.ingestGameEvent(envelope('system.changed', {
      ...empty.system,
      name: 'Sol',
      position: [0, 0, 0]
    }))
    application.ingestGameEvent(envelope('inventory.materials_changed', {
      updatedAt: '2026-08-11T20:00:00.000Z',
      raw: [],
      manufactured: [{ id: 'TestWidgets', label: 'Test Widgets', count: 7 }],
      encoded: []
    }))
    application.ingestGameEvent(envelope('inventory.material_consumed', {
      updatedAt: '2026-08-11T20:01:00.000Z',
      id: 'TestWidgets',
      label: 'Test Widgets',
      count: 2
    }))
    const api = new PhoenixApiClient(`http://${address.host}:${address.port}`)
    const engineers = await api.getEngineeringEngineers()
    const materials = await api.getEngineeringMaterials('manufactured')
    const blueprints = await api.getEngineeringBlueprints()
    const blueprint = await api.getEngineeringBlueprint('TestModule_Reinforced')

    expect(engineers.engineers).toHaveLength(1)
    expect(engineers.engineers.find(engineer => engineer.name === 'Ada Fixture')).toMatchObject({
      state: 'unlocked',
      progress: { rank: 5, rankProgress: 0, status: 'Unlocked' },
      system: { name: 'Test System' }
    })
    expect(materials.materials.find(material => material.id === 'TestWidgets')).toMatchObject({
      count: 5,
      maxCount: 300,
      grade: 1,
      group: 'Fixture components'
    })
    expect(blueprints.blueprints).toHaveLength(1)
    expect(blueprint.symbol).toBe('TestModule_Reinforced')
    expect(blueprint.grades[0]).toMatchObject({
      grade: 1,
      components: [{ name: 'Test Widgets', count: 5, cost: 1 }]
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
    event: 'EngineerProgress',
    Engineer: 'Didi Vatermann',
    EngineerID: 300000,
    Progress: 'Barred',
    Rank: 0,
    RankProgress: 0
  })
  service.ingest({
    timestamp: '2026-08-11T20:02:00Z',
    event: 'EngineerCraft',
    Ingredients: [{ Name: 'WornShieldEmitters', Name_Localised: 'Worn Shield Emitters', Count: 2 }]
  })

  expect(events).toEqual([
    expect.objectContaining({
      type: 'commander.engineers_changed',
      payload: [{ id: 300000, name: 'Didi Vatermann', status: 'Unlocked', rank: 4, rankProgress: 73 }]
    }),
    expect.objectContaining({
      type: 'commander.engineer_progress_changed',
      payload: { id: 300000, name: 'Didi Vatermann', status: 'Barred', rank: 0, rankProgress: 0 }
    }),
    expect.objectContaining({
      type: 'inventory.material_consumed',
      payload: expect.objectContaining({ id: 'WornShieldEmitters', label: 'Worn Shield Emitters', count: 2 })
    })
  ])
})

test('engineering projects persist blueprint plans and derive missing materials from observed inventory', async () => {
  const application = new PhoenixApplication({ databasePath: ':memory:', eliteDirectory: null, host: '127.0.0.1', port: 0 })
  const address = await application.start()
  try {
    application.ingestGameEvent(envelope('inventory.materials_changed', {
      updatedAt: '2026-08-11T20:00:00.000Z',
      raw: [],
      manufactured: [{ id: 'TestWidgets', label: 'Test Widgets', count: 5 }],
      encoded: []
    }))
    const api = new PhoenixApiClient(`http://${address.host}:${address.port}`)
    const project = await api.createEngineeringProject({ name: 'Explorer refit', note: 'FSD first', priority: 'high' })
    const planned = await api.addEngineeringProjectStep(project.id, {
      blueprintSymbol: 'TestModule_Reinforced',
      targetGrade: 1,
      plannedRolls: 8,
      note: null
    })

    expect(planned.steps[0]).toMatchObject({
      blueprintName: 'Reinforced Test Module',
      plannedRolls: 8,
      requirements: [{ materialId: 'TestWidgets', required: 8, unitCost: 1 }],
      targetGrade: 1
    })
    expect(await api.getEngineeringMaterialWatchlist()).toEqual({
      activeProjectCount: 1,
      materials: [expect.objectContaining({
        highestPriority: 'high',
        materialId: 'TestWidgets',
        missing: 3,
        owned: 5,
        projectCount: 1,
        required: 8,
        stepCount: 1
      })],
      observedAt: '2026-08-11T20:00:00.000Z',
      schemaVersion: 1
    })

    await api.updateEngineeringProject(project.id, {
      name: project.name,
      note: project.note,
      priority: project.priority,
      status: 'paused'
    })
    expect(await api.getEngineeringMaterialWatchlist()).toMatchObject({ activeProjectCount: 0, materials: [] })
  } finally {
    await application.stop()
  }
})

test('engineering projects survive an application restart', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'phoenix-engineering-projects-'))
  const databasePath = join(directory, 'phoenix.sqlite')
  let application = new PhoenixApplication({ databasePath, eliteDirectory: null, host: '127.0.0.1', port: 0 })
  try {
    let address = await application.start()
    const api = new PhoenixApiClient(`http://${address.host}:${address.port}`)
    await api.createEngineeringProject({ name: 'Persistent refit', note: null, priority: 'normal' })
    await application.stop()

    application = new PhoenixApplication({ databasePath, eliteDirectory: null, host: '127.0.0.1', port: 0 })
    address = await application.start()
    const restarted = new PhoenixApiClient(`http://${address.host}:${address.port}`)
    expect((await restarted.getEngineeringProjects()).projects).toEqual([
      expect.objectContaining({ name: 'Persistent refit', schemaVersion: 1, status: 'active' })
    ])
  } finally {
    await application.stop().catch(() => undefined)
    rmSync(directory, { force: true, recursive: true })
  }
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
