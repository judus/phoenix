import type { FleetResponse } from '@phoenix/contracts'

export function fleetFixture(): FleetResponse {
  return {
    activeShipId: 7,
    carriers: { observed: false, items: [] },
    ships: [{
      displayName: 'Viper Mk IV', hot: false, id: 7, identifier: 'VI-04', marketId: 1,
      name: 'MURDOCK', state: 'active', station: 'Atata Hub', system: 'Atata',
      transferPrice: null, transferSeconds: null, typeId: 'viper_mk_iv',
      updatedAt: '2026-08-16T12:00:00.000Z', value: 5_000_000
    }],
    storedModules: {
      details: 'complete',
      items: [{
        buyPrice: 100_000, displayName: 'Thrusters', engineering: { blueprint: 'DirtyDrive', level: 2, quality: 0.5 },
        hot: true, marketId: 1, rawName: '$int_engine_size5_class5_name;', storageSlot: 9,
        system: 'Atata', transferCost: 100, transferSeconds: 60, updatedAt: '2026-08-16T12:00:00.000Z'
      }],
      latestMutationAt: '2026-08-16T11:00:00.000Z',
      snapshotAt: '2026-08-16T12:00:00.000Z'
    },
    summary: { active: 1, owned: 1, stored: 0, transferring: 0, unknown: 0 }
  }
}
