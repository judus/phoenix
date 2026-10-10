import type { CommanderInventory, Mission, MissionRecord } from '@phoenix/contracts'
import { classifyMission } from '@phoenix/elite'

export function missionBriefing(record: MissionRecord, inventory: CommanderInventory): Mission {
  const items: Mission['briefing']['inventory']['items'] = []
  for (const store of ['backpack', 'shipLocker'] as const) {
    const snapshot = inventory[store]
    if (!snapshot) continue
    for (const bucket of ['items', 'components', 'consumables', 'data'] as const) {
      for (const item of snapshot[bucket]) {
        if (item.missionId !== record.id || item.count === 0) continue
        items.push({
          id: item.id, label: item.label, count: item.count, store, observedAt: snapshot.updatedAt
        })
      }
    }
  }
  return {
    ...record,
    briefing: {
      ...classifyMission(record.name),
      inventory: {
        backpackAt: inventory.backpack?.updatedAt ?? null,
        shipLockerAt: inventory.shipLocker?.updatedAt ?? null,
        items
      }
    }
  }
}
