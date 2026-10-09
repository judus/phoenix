import { afterEach, expect, test, vi } from 'vitest'
import { CommunityGoalsResponseSchema } from '@phoenix/contracts'
import { CommunityGoalsService } from '../apps/server/src/application/community-goals-service.js'
import { FrontierCommunityGoalsSource } from '../apps/server/src/infrastructure/frontier-community-goals-source.js'
import { SqliteDatabase } from '../apps/server/src/infrastructure/sqlite-database.js'
import { PhoenixApplication } from '../apps/server/src/phoenix-application.js'
import { PhoenixApiClient } from '../apps/web/src/platform/api/phoenix-api-client.js'

// Synthetic provider document; no commander data or copied briefing text.
const initiative = {
  id: 'test-1', title: 'Supply a research initiative', starsystem_name: 'Sol', market_name: 'Galileo',
  activityType: 'trade', objective: 'Deliver supplies', target_commodity_list: 'Basic Medicines',
  qty: '125', target_qty: '1000', expiry: '2026-10-08 10:00:00', bulletin: 'Sign up at Galileo.\nDeliver supplies.',
  images: 'ignored', additionalProviderField: true
}
const goal = {
  id: 'test-1', title: initiative.title, systemName: 'Sol', stationName: 'Galileo',
  activityType: 'trade', objective: initiative.objective, targetCommodities: 'Basic Medicines',
  contributed: 125, target: 1000, expiry: initiative.expiry, briefing: initiative.bulletin
}

const databases: SqliteDatabase[] = []
afterEach(() => { for (const db of databases.splice(0)) db.close() })
function database(): SqliteDatabase {
  const db = new SqliteDatabase(':memory:')
  db.initialize()
  databases.push(db)
  return db
}

test('Frontier adapter requests the public English listing and validates/normalizes quantities', async () => {
  const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ activeInitiatives: [initiative] }))
  await expect(new FrontierCommunityGoalsSource(request).getCurrent()).resolves.toEqual([goal])
  expect(request).toHaveBeenCalledWith(
    'https://www.elitedangerous.com/elite-proxy/2.0/website/initiatives/list?lang=en',
    expect.objectContaining({ headers: { accept: 'application/json' }, signal: expect.any(AbortSignal) }))
})

test.each([
  { activeInitiatives: [{ ...initiative, qty: '12 rubbish' }] },
  { activeInitiatives: [{ ...initiative, qty: '-1' }] },
  { activeInitiatives: [{ ...initiative, qty: '9007199254740993' }] },
  { activeInitiatives: [{ ...initiative, target_qty: '0' }] },
  { activeInitiatives: [{ ...initiative, starsystem_name: '' }] },
  { activeInitiatives: [{ ...initiative, bulletin: undefined }] },
  { other: [] }
])('malformed provider data is an error, never an authoritative empty list: %j', async document => {
  const source = new FrontierCommunityGoalsSource(async () => Response.json(document))
  await expect(source.getCurrent()).rejects.toThrow()
})

test('successful empty listing and HTTP/JSON errors are distinct', async () => {
  await expect(new FrontierCommunityGoalsSource(async () => Response.json({ activeInitiatives: [] })).getCurrent()).resolves.toEqual([])
  await expect(new FrontierCommunityGoalsSource(async () => new Response('offline', { status: 503 })).getCurrent()).rejects.toThrow('(503)')
  await expect(new FrontierCommunityGoalsSource(async () => new Response('<html>not JSON</html>')).getCurrent()).rejects.toThrow()
})

test('SQLite snapshots are reused by a new service and failed/malformed refreshes retain original timestamp', async () => {
  const db = database()
  let time = new Date('2026-10-07T12:00:00Z')
  const source = { getCurrent: vi.fn().mockResolvedValue([goal]) }
  const service = new CommunityGoalsService(source, db, () => time)
  const first = await service.getCurrent()
  expect(first).toEqual({ goals: [goal], fetchedAt: time.toISOString(), cache: 'refreshed' })
  const resumed = new CommunityGoalsService(source, db, () => time)
  expect(await resumed.getCurrent()).toEqual({ ...first, cache: 'fresh' })
  expect(source.getCurrent).toHaveBeenCalledTimes(1)

  time = new Date('2026-10-07T12:16:00Z')
  source.getCurrent.mockRejectedValueOnce(new Error('offline'))
  expect(await resumed.getCurrent()).toEqual({ ...first, cache: 'stale' })
  source.getCurrent.mockResolvedValueOnce([{ ...goal, target: 0 }])
  expect(await resumed.getCurrent()).toEqual({ ...first, cache: 'stale' })

  source.getCurrent.mockResolvedValueOnce([])
  expect(await resumed.getCurrent()).toEqual({ goals: [], fetchedAt: time.toISOString(), cache: 'refreshed' })
  time = new Date('2026-10-07T12:32:00Z')
  source.getCurrent.mockRejectedValueOnce(new Error('offline'))
  expect(await resumed.getCurrent()).toEqual({ goals: [], fetchedAt: '2026-10-07T12:16:00.000Z', cache: 'stale' })
})

test('concurrent refreshes share a fetch and cold failures surface to the caller', async () => {
  const db = database()
  const source = { getCurrent: vi.fn().mockResolvedValue([goal]) }
  const service = new CommunityGoalsService(source, db)
  const responses = await Promise.all([service.getCurrent(), service.getCurrent(), service.getCurrent()])
  expect(source.getCurrent).toHaveBeenCalledTimes(1)
  expect(responses.every(response => response.cache === 'refreshed')).toBe(true)
  const failed = new CommunityGoalsService({ getCurrent: async () => { throw new Error('offline') } }, database())
  await expect(failed.getCurrent()).rejects.toThrow('offline')
})

test('real HTTP composition and browser client serve validated goals without AI or game files', async () => {
  const source = { getCurrent: vi.fn().mockResolvedValue([goal]) }
  const application = new PhoenixApplication({
    databasePath: ':memory:', eliteDirectory: null, host: '127.0.0.1', port: 0, communityGoalsSource: source
  })
  const address = await application.start()
  try {
    expect(source.getCurrent).not.toHaveBeenCalled()
    const client = new PhoenixApiClient(`http://${address.host}:${address.port}`)
    const result = await client.getCommunityGoals()
    expect(CommunityGoalsResponseSchema.parse(result)).toMatchObject({ goals: [goal], cache: 'refreshed' })
    await expect(client.getCommunityGoals()).resolves.toMatchObject({ goals: [goal], cache: 'fresh' })
    expect(source.getCurrent).toHaveBeenCalledTimes(1)
  } finally { await application.stop() }
})
