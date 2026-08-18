import { expect, test } from 'vitest'
import type { MissionsResponse } from '@phoenix/contracts'
import { MissionRuntimeContext } from '../apps/server/src/application/mission-runtime-context.js'

test('mission runtime context stays compact and marks incomplete evidence', () => {
  const response: MissionsResponse = {
    missions: [{
      acceptedAt: null, abandonedAt: null, commodity: null, commodityCount: null,
      completedAt: null, destinationSettlement: null, destinationStation: 'Galileo',
      destinationSystem: 'Sol', donated: null, donation: null, expiry: null, faction: null,
      failedAt: null, id: 42, influence: null, killCount: null, localizedName: 'Deliver medicines',
      name: 'Mission_Delivery_name', passengerCount: null,
      progress: { collected: null, delivered: 3, required: 12 },
      provenance: { acceptanceObserved: false, details: 'partial', snapshotObserved: true, sources: ['startup-snapshot'], terminalObserved: false },
      redirectedAt: null, reputation: null, reward: null, status: 'active', statusUpdatedAt: '2026-08-15T12:00:00Z',
      target: null, targetFaction: null, targetType: null, updatedAt: '2026-08-15T12:00:00Z', wing: null
    }],
    snapshotAt: '2026-08-15T12:00:00Z',
    summary: { abandoned: 0, active: 1, completed: 0, failed: 0, partial: 1, total: 1, unknown: 0 }
  }
  const rendered = new MissionRuntimeContext({ getMissions: () => response }).render()
  expect(rendered).toContain('1 active')
  expect(rendered).toContain('Deliver medicines · Sol / Galileo · 3/12 delivered · details incomplete')
})
