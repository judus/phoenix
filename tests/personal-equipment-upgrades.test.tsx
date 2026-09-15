import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'
import { JsonPersonalEquipmentCatalogue } from '@phoenix/elite'
import { PersonalEquipmentUpgradesService } from '../apps/server/src/application/personal-equipment-upgrades-service.js'
import { PhoenixApplication } from '../apps/server/src/phoenix-application.js'
import { EquipmentUpgradesPage } from '../apps/web/src/features/equipment/equipment-upgrades-page.js'
import { PhoenixApiClient } from '../apps/web/src/platform/api/phoenix-api-client.js'

const fixture = join(fileURLToPath(new URL('./fixtures/catalogue/', import.meta.url)), 'personal-equipment.json')
const service = new PersonalEquipmentUpgradesService(new JsonPersonalEquipmentCatalogue(fixture))

describe('personal equipment upgrades', () => {
  test('projects the strict catalogue into a source-recorded read model', () => {
    expect(service.getUpgrades()).toMatchObject({
      schemaVersion: 1,
      catalogueVersion: '0000000000000000000000000000000000000000',
      gradeUpgradePaths: [{
        id: 'grade:suit:test-suit',
        name: 'Test Suit',
        equipmentNames: ['Test Suit'],
        steps: [{ ingredients: [{ materialId: 'test-material', materialName: 'Test Material', group: 'goods', count: 2 }] }]
      }],
      modifications: [{
        id: 'suit_test',
        name: 'Test Modification',
        ingredients: [{ materialName: 'Test Material', count: 1 }]
      }]
    })
  })

  test('renders the upgrades index and dedicated recipe detail', () => {
    const upgrades = service.getUpgrades()
    const controller = { status: 'ready' as const, upgrades }
    const index = renderToStaticMarkup(<EquipmentUpgradesPage controller={controller} />)
    const detail = renderToStaticMarkup(<EquipmentUpgradesPage controller={controller} selectedUpgradeId="suit_test" />)

    expect(index).toContain('Grade upgrades')
    expect(index).toContain('Permanent modifications')
    expect(index).toContain('#/equipment/upgrades?id=suit_test')
    expect(detail).toContain('Test Modification')
    expect(detail).toContain('Test Material')
    expect(detail).toContain('Credit cost')
  })

  test('exposes the read model through the equipment API', async () => {
    const application = new PhoenixApplication({ databasePath: ':memory:', eliteDirectory: null, host: '127.0.0.1', port: 0 })
    const address = await application.start()
    try {
      const upgrades = await new PhoenixApiClient(`http://${address.host}:${address.port}`).getPersonalEquipmentUpgrades()
      expect(upgrades.gradeUpgradePaths[0]?.name).toBe('Test Suit')
    } finally {
      await application.stop()
    }
  })
})
