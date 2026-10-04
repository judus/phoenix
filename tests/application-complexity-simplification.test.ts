import { expect, test } from 'vitest'
import { createEmptyRuntimeState, type EngineeringProject } from '@phoenix/contracts'
import { fileURLToPath } from 'node:url'
import { JsonEngineeringCatalogue } from '@phoenix/elite'
import { EngineeringDataService } from '../apps/server/src/application/engineering-data-service.js'
import { EngineeringProjectService } from '../apps/server/src/application/engineering-project-service.js'
import { CartographyObservationIngestionService } from '../apps/server/src/application/cartography-observation-ingestion-service.js'
import { DefaultCommanderEquipmentCatalogue } from '../apps/server/src/application/commander-equipment-catalogue.js'
import { InMemoryRuntimeStateStore } from '../apps/server/src/infrastructure/in-memory-runtime-state-store.js'
import { SqliteDatabase } from '../apps/server/src/infrastructure/sqlite-database.js'

test('organic scan body IDs use the same safe raw-number predicate as other journal IDs', () => {
  const database = new SqliteDatabase(':memory:')
  database.initialize()
  try {
    const runtime = new InMemoryRuntimeStateStore()
    const state = createEmptyRuntimeState()
    runtime.replace({ ...state, system: { ...state.system, name: 'Test System' } })
    const ingestion = new CartographyObservationIngestionService(database, runtime, { publish: () => {} })
    const candidates = [0, 5, -1, 0.5, '5', null, {}, Number.MAX_SAFE_INTEGER + 1, Number.NaN, Number.POSITIVE_INFINITY]
    for (const [index, Body] of candidates.entries()) {
      ingestion.ingest({ event: 'ScanOrganic', timestamp: '2026-10-04T12:00:00Z', Body, BodyName: `Body ${index}`,
        ScanType: 'Log', Genus: 'Bacterium', Species: 'Aurasus', Variant: 'Lime' })
    }
    expect(database.findRecord('Test System')?.local?.bodies.map(body => body.bodyId))
      .toEqual([0, 5, null, null, null, null, null, null, null, null])
  } finally { database.close() }
})

test('unknown equipment names retain the existing lowercase-first fallback labels', () => {
  const catalogue = new DefaultCommanderEquipmentCatalogue()
  expect(catalogue.resolveSuit('$OddGear_class2_name;', null).displayName).toBe('Oddgear')
  expect(catalogue.resolveWeapon('wpn_m_new_weapon', null).displayName).toBe('New Weapon')
  expect(catalogue.resolveModification('unknownCamelCase')).toBe('Unknowncamelcase')
  expect(catalogue.resolveResource('unknown_resource', null)).toBe('Unknown Resource')
  expect(catalogue.resolveSuit('unknown_suit', 'Observed Suit').displayName).toBe('Observed Suit')
})

test('material watchlists aggregate all active steps and omit fully owned materials', () => {
  const path = (name: string) => fileURLToPath(new URL(`./fixtures/catalogue/engineering/${name}.json`, import.meta.url))
  const catalogue = new JsonEngineeringCatalogue({ blueprints: path('blueprints'), engineers: path('engineers'),
    materials: path('materials'), materialUses: path('material-uses') })
  const runtime = new InMemoryRuntimeStateStore()
  const projects = new Map<string, EngineeringProject>()
  const service = new EngineeringProjectService({
    getProject: id => projects.get(id) ?? null, listProjects: () => [...projects.values()],
    putProject: project => { projects.set(project.id, project) }, deleteProject: id => { projects.delete(id) }
  }, catalogue, new EngineeringDataService(catalogue, runtime), { publish () {}, subscribe: () => () => {} })
  const normal = service.create({ name: 'Normal refit', note: null, priority: 'normal' })
  const high = service.create({ name: 'Priority refit', note: null, priority: 'high' })
  for (const [projectId, plannedRolls] of [[normal.id, 3], [normal.id, 4], [high.id, 5]] as const) {
    service.addStep(projectId, { blueprintSymbol: 'TestModule_Reinforced', targetGrade: 1, plannedRolls, note: null })
  }
  const withOwned = (count: number) => {
    const state = runtime.getCurrent()
    runtime.replace({ ...state, inventory: { ...state.inventory, materials: { updatedAt: '2026-10-04T12:00:00Z', raw: [], encoded: [],
      manufactured: [{ id: 'TestWidgets', label: 'Test Widgets', count }] } } })
  }
  withOwned(2)
  expect(service.getMaterialWatchlist()).toMatchObject({ activeProjectCount: 2, materials: [{
    materialId: 'TestWidgets', required: 12, owned: 2, missing: 10, stepCount: 3, projectCount: 2, highestPriority: 'high',
    projects: [{ id: normal.id, name: normal.name }, { id: high.id, name: high.name }]
  }] })
  withOwned(12)
  expect(service.getMaterialWatchlist()).toMatchObject({ activeProjectCount: 2, materials: [] })
})
