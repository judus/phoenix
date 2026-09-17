import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'
import { createEmptyRuntimeState } from '@phoenix/contracts'
import { JsonEngineeringCatalogue, JsonPersonalEquipmentCatalogue } from '@phoenix/elite'
import { PersonalEquipmentSpecialistsService } from '../apps/server/src/application/personal-equipment-specialists-service.js'
import { InMemoryRuntimeStateStore } from '../apps/server/src/infrastructure/in-memory-runtime-state-store.js'
import { PhoenixApplication } from '../apps/server/src/phoenix-application.js'
import { EquipmentSpecialistsPage } from '../apps/web/src/features/equipment/equipment-specialists-page.js'
import { PhoenixApiClient } from '../apps/web/src/platform/api/phoenix-api-client.js'

const fixture = join(fileURLToPath(new URL('./fixtures/catalogue/', import.meta.url)), 'personal-equipment.json')
const engineeringFixture = fileURLToPath(new URL('./fixtures/catalogue/engineering/', import.meta.url))

describe('personal equipment specialists', () => {
  test('groups externally reported modification capabilities by canonical engineer identity', () => {
    const service = createService('complete')
    expect(service.getSpecialists()).toMatchObject({
      schemaVersion: 2,
      specialists: [{
        id: 'test-engineer',
        frontierEngineerId: 900002,
        name: 'Test Engineer',
        access: { state: 'unlocked', reportedStatus: 'Unlocked', evidence: 'elite_journal' },
        location: { systemName: 'Specialist System', distanceLy: 5, evidence: 'external_catalogue' },
        modifications: [{ id: 'suit_test', name: 'Test Modification', targetKind: 'suit' }]
      }]
    })
  })

  test('renders the specialist directory and dedicated capability detail', () => {
    const service = createService('complete')
    const specialists = service.getSpecialists()
    const controller = { status: 'ready' as const, specialists }
    const index = renderToStaticMarkup(<EquipmentSpecialistsPage controller={controller} />)
    const detail = renderToStaticMarkup(<EquipmentSpecialistsPage controller={controller} selectedSpecialistId="test-engineer" />)

    expect(index).toContain('Unlocked specialists')
    expect(index).toContain('Specialist System')
    expect(index).toContain('5 LY')
    expect(index).toContain('#/equipment/specialists?id=test-engineer')
    expect(detail).toContain('Test Engineer')
    expect(detail).toContain('#/equipment/upgrades?id=suit_test')
  })

  test('does not call an unobserved specialist locked before a complete startup summary', () => {
    const specialist = createService('unknown').getSpecialists().specialists[0]
    expect(specialist?.access).toEqual({ state: 'unknown', reportedStatus: null, evidence: 'not_observed' })
  })

  test('exposes the directory through the equipment API', async () => {
    const application = new PhoenixApplication({ databasePath: ':memory:', eliteDirectory: null, host: '127.0.0.1', port: 0 })
    const address = await application.start()
    try {
      const specialists = await new PhoenixApiClient(`http://${address.host}:${address.port}`).getPersonalEquipmentSpecialists()
      expect(specialists.specialists[0]?.name).toBe('Test Engineer')
    } finally {
      await application.stop()
    }
  })
})

function createService(coverage: 'complete' | 'unknown'): PersonalEquipmentSpecialistsService {
  const state = new InMemoryRuntimeStateStore()
  const empty = createEmptyRuntimeState()
  state.replace({
    ...empty,
    commander: {
      ...empty.commander,
      engineerAccessCoverage: coverage,
      engineers: coverage === 'complete'
        ? [{ id: 900002, name: 'Test Engineer', status: 'Unlocked', rank: 0, rankProgress: 0 }]
        : []
    },
    system: { ...empty.system, position: [1, 2, 3] }
  })
  return new PersonalEquipmentSpecialistsService(
    new JsonPersonalEquipmentCatalogue(fixture),
    new JsonEngineeringCatalogue({
      blueprints: join(engineeringFixture, 'blueprints.json'),
      engineers: join(engineeringFixture, 'engineers.json'),
      materials: join(engineeringFixture, 'materials.json'),
      materialUses: join(engineeringFixture, 'material-uses.json')
    }),
    state
  )
}
