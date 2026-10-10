import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { SqliteDatabase } from '../apps/server/src/infrastructure/sqlite-database.js'
import { PowerplayDataService } from '../apps/server/src/application/powerplay-data-service.js'

test('Powerplay uses authoritative totals, preserves fractions and deduplicates replay across reopen', () => {
  const directory = mkdtempSync(join(tmpdir(), 'phoenix-powerplay-'))
  const path = join(directory, 'state.sqlite')
  let database = new SqliteDatabase(path)
  const snapshot = { timestamp: '2026-10-10T10:00:00Z', event: 'Powerplay', Power: 'Aisling Duval', Rank: 2, Merits: 2000, TimePledged: 3600 }
  const gain = { timestamp: '2026-10-10T10:01:00Z', event: 'PowerplayMerits', Power: 'Aisling Duval', MeritsGained: 12.5, TotalMerits: 5012.5 }
  try {
    database.initialize()
    let service = new PowerplayDataService(database.powerplay)
    service.ingest(snapshot)
    service.ingest(gain)
    service.ingest({ timestamp: '2026-10-10T10:02:00Z', event: 'PowerplayRank', Power: 'Aisling Duval', Rank: 3 })
    service.setTarget({ power: 'Aisling Duval', name: 'A target', rank: 4, merits: 9000 })
    const before = service.getPowerplay()
    expect(before.pledge).toMatchObject({ power: 'Aisling Duval', rank: 3, merits: 5012.5, pledgedAt: '2026-10-10T09:00:00.000Z' })
    expect(before.targetProgress).toEqual({ status: 'tracking', remainingMerits: 3987.5 })
    database.close()
    database = new SqliteDatabase(path)
    database.initialize()
    service = new PowerplayDataService(database.powerplay)
    service.ingest(snapshot); service.ingest(gain)
    expect(service.getPowerplay()).toEqual(before)
  } finally { database.close(); rmSync(directory, { recursive: true, force: true }) }
})

test('backfill cannot replace later snapshots; leave/repledge resets observations without inventing zero', () => {
  const database = new SqliteDatabase(':memory:')
  try {
    database.initialize()
    const service = new PowerplayDataService(database.powerplay)
    service.setTarget({ power: 'Aisling Duval', name: 'Test target', rank: 4, merits: null })
    expect(service.getPowerplay().pledge.status).toBe('unknown')
    service.ingest({ timestamp: '2026-10-10T10:00:00Z', event: 'Powerplay', Power: 'Aisling Duval', Rank: 3, Merits: 5000, TimePledged: 86400 })
    service.ingest({ timestamp: '2026-10-09T10:00:00Z', event: 'Powerplay', Power: 'Edmund Mahon', Rank: 50, Merits: 500000, TimePledged: 86400 })
    service.ingest({ timestamp: '2026-10-10T10:01:00Z', event: 'PowerplayMerits', Power: 'Edmund Mahon', MeritsGained: 100, TotalMerits: 500100 })
    expect(service.getPowerplay().pledge).toMatchObject({ power: 'Aisling Duval', rank: 3, merits: 5000 })
    service.ingest({ timestamp: '2026-10-10T10:02:00Z', event: 'PowerplayLeave', Power: 'Aisling Duval' })
    expect(service.getPowerplay().pledge).toMatchObject({ status: 'left', power: null, rank: null, merits: null })
    expect(service.getPowerplay().targetProgress?.status).toBe('unpledged')
    service.ingest({ timestamp: '2026-10-10T10:03:00Z', event: 'PowerplayJoin', Power: 'Aisling Duval' })
    expect(service.getPowerplay().pledge).toMatchObject({ status: 'pledged', power: 'Aisling Duval', rank: null, merits: null })
    service.ingest({ timestamp: '2026-10-10T10:04:00Z', event: 'PowerplayDefect', FromPower: 'Aisling Duval', ToPower: 'Edmund Mahon' })
    expect(service.getPowerplay().pledge).toMatchObject({ power: 'Edmund Mahon', rank: null, merits: null })
  } finally { database.close() }
})

test('partial observations are honest; invalid journal input is ignored and target thresholds do not assert unlocks', () => {
  const database = new SqliteDatabase(':memory:')
  try {
    database.initialize()
    const service = new PowerplayDataService(database.powerplay)
    service.ingest({ timestamp: '2026-10-10T10:00:00Z', event: 'PowerplayMerits', Power: 'Aisling Duval', MeritsGained: 1.25, TotalMerits: 100 })
    expect(service.getPowerplay().pledge).toMatchObject({ power: 'Aisling Duval', rank: null, merits: 100, pledgedAt: null })
    service.ingest({ timestamp: '2026-10-10T10:01:00Z', event: 'PowerplayRank', Power: 'Aisling Duval', Rank: -1 })
    service.ingest({ timestamp: '2026-10-10T10:01:00Z', event: 'PowerplayMerits', Power: 'Aisling Duval', MeritsGained: 1 })
    service.ingest({ timestamp: '2026-10-10T10:01:00Z', event: 'Powerplay', Power: 'Aisling Duval', Rank: 3, Merits: 5000, TimePledged: 1e100 })
    expect(service.getPowerplay().retained).toBe(1)
    service.ingest({ timestamp: '2026-10-10T10:02:00Z', event: 'PowerplayCollect', Power: 'Aisling Duval', Type: 'Preparation materials', Count: 20 })
    expect(database.powerplay.projectionEntries().map(entry => entry.kind)).toEqual(['merits'])
    expect(service.getPowerplay().entries[0]).toMatchObject({ kind: 'collect', count: 20 })
    expect(service.setTarget({ power: 'Aisling Duval', name: 'Merit target', rank: null, merits: 100 }).targetProgress?.status).toBe('requirements-met')
    expect(service.setTarget({ power: 'Aisling Duval', name: 'Rank target', rank: 1, merits: null }).targetProgress?.status).toBe('unknown')
    expect(service.setTarget({ power: 'Edmund Mahon', name: 'Other target', rank: 1, merits: null }).targetProgress?.status).toBe('different-power')
    expect(() => service.setTarget({ power: 'Aisling Duval', name: 'No threshold', rank: null, merits: null })).toThrow('Enter a required rank')
    expect(service.setTarget(null).target).toBeNull()
  } finally { database.close() }
})
