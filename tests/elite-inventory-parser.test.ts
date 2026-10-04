import { expect, test } from 'vitest'
import { EliteInventoryFileSnapshotSchema } from '@phoenix/contracts'
import { parseEliteInventoryFile } from '../packages/elite/src/inventory/elite-inventory-parser.js'

const timestamp = '2026-10-04T12:00:00Z'

test('cargo dispatch retains canonical defaults, zero IDs and vessel normalization', () => {
  const raw = {
    event: 'Cargo', timestamp, Vessel: ' SRV ', ignored: true,
    Inventory: [{ Name: 'gold', Count: 0, MissionID: 0, ignored: true }]
  }
  const before = structuredClone(raw)
  const result = parseEliteInventoryFile(raw)
  expect(result).toEqual({
    kind: 'cargo', payload: {
      updatedAt: timestamp, vessel: 'srv',
      items: [{ id: 'gold', label: null, count: 0, stolen: 0, missionId: 0 }]
    }
  })
  expect(EliteInventoryFileSnapshotSchema.parse(result)).toEqual(result)
  expect(raw).toEqual(before)
})

test.each([
  ['ShipLocker', 'ship_locker'], ['Backpack', 'backpack'], ['BackpackMaterials', 'backpack']
])('%s dispatch retains resource defaults and canonical %s discriminator', (event, kind) => {
  const result = parseEliteInventoryFile({ event, timestamp, Items: [{ Name: 'healthpack', Count: 1, OwnerID: 0 }] })
  expect(result).toEqual({ kind, payload: {
    updatedAt: timestamp,
    items: [{ id: 'healthpack', label: null, count: 1, ownerId: 0, missionId: null }],
    components: [], consumables: [], data: []
  } })
  expect(EliteInventoryFileSnapshotSchema.parse(result)).toEqual(result)
})

test('missing cargo inventory is empty and unrecognized vessel remains unknown', () => {
  expect(parseEliteInventoryFile({ event: 'Cargo', timestamp, Vessel: 'fighter' })).toEqual({
    kind: 'cargo', payload: { updatedAt: timestamp, vessel: 'unknown', items: [] }
  })
})

test.each([
  null, {}, { event: 'Cargo', timestamp: 'invalid' },
  { event: 'Cargo', timestamp, Inventory: [{ Name: 'gold', Count: -1 }] },
  { event: 'Cargo', timestamp, Inventory: [{ Name: 'gold', Count: 1, Stolen: -1 }] },
  { event: 'Backpack', timestamp, Items: [{ Name: 'healthpack', Count: 1.5 }] },
  { event: 'ShipLocker', timestamp, Items: 'not-an-array' }
])('invalid raw inventory is still rejected: %j', raw => {
  expect(() => parseEliteInventoryFile(raw)).toThrow()
})

test('unsupported event retains the existing explicit rejection', () => {
  expect(() => parseEliteInventoryFile({ event: 'Materials', timestamp }))
    .toThrow('Unsupported Elite inventory file event: Materials.')
})
