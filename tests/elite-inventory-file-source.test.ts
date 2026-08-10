import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import type { EliteInventoryFileSnapshot } from '@phoenix/contracts'
import { EliteInventoryFileSource } from '@phoenix/elite'

test('the inventory source reads, deduplicates and refreshes Elite state files', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'phoenix-inventory-source-'))
  const snapshots: EliteInventoryFileSnapshot[] = []
  writeFileSync(join(directory, 'Cargo.json'), JSON.stringify({
    timestamp: '2026-08-10T12:00:00Z',
    event: 'Cargo',
    Vessel: 'Ship',
    Inventory: [{ Name: 'gold', Name_Localised: 'Gold', Count: 2, Stolen: 1 }]
  }))
  writeFileSync(join(directory, 'ShipLocker.json'), JSON.stringify({
    timestamp: '2026-08-10T12:00:01Z',
    event: 'ShipLocker',
    Items: [], Components: [], Consumables: [], Data: []
  }))
  writeFileSync(join(directory, 'Backpack.json'), JSON.stringify({
    timestamp: '2026-08-10T12:00:02Z',
    event: 'Backpack',
    Items: [], Components: [], Consumables: [{ Name: 'healthpack', Count: 1 }], Data: []
  }))
  const source = new EliteInventoryFileSource(directory, snapshot => { snapshots.push(snapshot) }, {
    pollInterval: 60_000,
    retryDelay: 1
  })

  try {
    await source.start()
    expect(snapshots).toHaveLength(3)
    expect(await source.refresh()).toBe(false)
    expect(snapshots).toContainEqual(expect.objectContaining({
      kind: 'cargo',
      payload: expect.objectContaining({
        vessel: 'ship',
        items: [{ id: 'gold', label: 'Gold', count: 2, stolen: 1, missionId: null }]
      })
    }))

    writeFileSync(join(directory, 'Cargo.json'), JSON.stringify({
      timestamp: '2026-08-10T12:03:00Z',
      event: 'Cargo',
      Vessel: 'Ship',
      Inventory: []
    }))
    expect(await source.refresh()).toBe(true)
    expect(snapshots.at(-1)).toMatchObject({ kind: 'cargo', payload: { items: [] } })
  } finally {
    source.stop()
    rmSync(directory, { recursive: true, force: true })
  }
})
