import { describe, expect, test, vi } from 'vitest'
import { PhoenixApiClient } from '../apps/web/src/platform/api/phoenix-api-client.js'

test('the API client invokes a browser-style fetch with the global receiver', async () => {
  const browserStyleFetch = function (this: typeof globalThis, input: string | URL | Request): Promise<Response> {
    expect(this).toBe(globalThis)
    expect(String(input)).toBe('/api/health')
    return Promise.resolve(new Response(JSON.stringify({
      apiVersion: '1',
      database: { connected: true, engine: 'sqlite' },
      name: 'PHOENIX',
      status: 'ok',
      timestamp: '2026-08-10T00:00:00.000Z'
    }), {
      headers: { 'content-type': 'application/json' },
      status: 200
    }))
  } as typeof fetch

  const health = await new PhoenixApiClient('', browserStyleFetch).getHealth()

  expect(health.status).toBe('ok')
})

describe('pairing transport', () => {
  test('validates status and claims with same-origin browser credentials', async () => {
    const request = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({
        authenticated: false,
        installationId: 'installation-1',
        pairingRequired: true,
        serverDevice: false
      }))
      .mockResolvedValueOnce(jsonResponse({
        authenticated: true,
        installationId: 'installation-1',
        pairingRequired: true,
        serverDevice: false
      }))
      .mockResolvedValueOnce(jsonResponse({
        access: [{
          pairingUrl: 'http://192.168.1.42:3400/#pair=ABCDE-12345',
          qrDataUrl: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=',
          url: 'http://192.168.1.42:3400'
        }],
        installationId: 'installation-1',
        pairingCode: 'ABCDE-12345',
        serverDevice: true
      }))
    const client = new PhoenixApiClient('', request)

    await expect(client.getPairingStatus()).resolves.toMatchObject({ authenticated: false })
    await expect(client.claimPairing('ABCDE-12345')).resolves.toMatchObject({ authenticated: true })
    await expect(client.getPairingInfo()).resolves.toMatchObject({ pairingCode: 'ABCDE-12345' })

    expect(request).toHaveBeenNthCalledWith(1, '/api/pairing/status', expect.objectContaining({
      credentials: 'same-origin'
    }))
    expect(request).toHaveBeenNthCalledWith(2, '/api/pairing/claim', expect.objectContaining({
      body: JSON.stringify({ code: 'ABCDE-12345' }),
      credentials: 'same-origin',
      method: 'POST'
    }))
    expect(request).toHaveBeenNthCalledWith(3, '/api/pairing/info', expect.objectContaining({
      credentials: 'same-origin'
    }))
  })

  test('rejects malformed pairing evidence', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ authenticated: true }))
    await expect(new PhoenixApiClient('', request).getPairingStatus()).rejects.toThrow()
  })
})

test('Galaxy system search serializes typed parameters and validates the response', async () => {
  const request = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({
    cache: 'fresh',
    filters: {
      allegiance: null,
      economy: 'High Tech',
      government: null,
      maxDistanceLy: 75,
      maxPopulation: null,
      minPopulation: 1,
      population: 'inhabited',
      security: null
    },
    originSystem: 'Sol',
    systems: []
  }))

  await expect(new PhoenixApiClient('', request).findGalaxySystems({
    economy: 'High Tech',
    maxDistance: 75,
    minPopulation: 1,
    population: 'inhabited',
    system: 'Sol'
  })).resolves.toMatchObject({ originSystem: 'Sol', systems: [] })

  expect(request.mock.calls[0]?.[0]).toBe('/api/galaxy/systems/search?maxDistance=75&population=inhabited&system=Sol&economy=High+Tech&minPopulation=1')
})

test('Elite destination transport sends a validated system name to the durable navigation endpoint', async () => {
  const request = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({
    requestedSystem: 'Sol',
    confirmedSystem: 'Sol',
    status: 'confirmed',
    phase: 'confirm_route',
    message: 'Route to Sol was confirmed.'
  }))

  await expect(new PhoenixApiClient('', request).plotEliteDestination(' Sol ')).resolves.toMatchObject({
    requestedSystem: 'Sol',
    status: 'confirmed'
  })
  expect(request).toHaveBeenCalledWith('/api/navigation/destination', expect.objectContaining({
    body: JSON.stringify({ systemName: 'Sol' }),
    method: 'POST'
  }))
})

test('mission transport uses the durable Operations endpoint and validates its contract', async () => {
  const request = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({
    missions: [],
    snapshotAt: null,
    summary: { abandoned: 0, active: 0, completed: 0, failed: 0, partial: 0, total: 0, unknown: 0 }
  }))

  await expect(new PhoenixApiClient('', request).getMissions()).resolves.toMatchObject({ missions: [], summary: { total: 0 } })
  expect(request.mock.calls[0]?.[0]).toBe('/api/operations/missions')
})

test('Comms transports validate retained messages and cached GalNet', async () => {
  const request = vi.fn<typeof fetch>()
    .mockResolvedValueOnce(jsonResponse({
      contacts: [], messages: [],
      summary: { inbound: 0, inbox: 0, outbound: 0, total: 0, traffic: 0 }, view: 'traffic'
    }))
    .mockResolvedValueOnce(jsonResponse({
      generatedAt: '2026-08-16T12:00:00.000Z', messages: [], schemaVersion: 1, windowMinutes: 90
    }))
    .mockResolvedValueOnce(jsonResponse({ articles: [], cache: 'fresh', fetchedAt: '2026-08-16T12:00:00.000Z' }))
  const client = new PhoenixApiClient('', request)

  await expect(client.getCommunications('traffic', 25)).resolves.toMatchObject({ messages: [], view: 'traffic' })
  await expect(client.getLocalTraffic(5)).resolves.toMatchObject({ messages: [], schemaVersion: 1 })
  await expect(client.getGalnetNews(10)).resolves.toMatchObject({ articles: [], cache: 'fresh' })
  expect(request.mock.calls[0]?.[0]).toBe('/api/comms/messages?limit=25&view=traffic')
  expect(request.mock.calls[1]?.[0]).toBe('/api/comms/local-traffic?limit=5')
  expect(request.mock.calls[2]?.[0]).toBe('/api/galnet?limit=10')
})

test('Engineering transports preserve the existing read API', async () => {
  const request = vi.fn<typeof fetch>()
    .mockResolvedValueOnce(jsonResponse({ engineers: [] }))
    .mockResolvedValueOnce(jsonResponse({ materials: [], updatedAt: null }))
    .mockResolvedValueOnce(jsonResponse({ blueprints: [] }))
  const client = new PhoenixApiClient('', request)
  await client.getEngineeringEngineers()
  await client.getEngineeringMaterials('manufactured')
  await client.getEngineeringBlueprints()
  expect(request.mock.calls.map(call => call[0])).toEqual([
    '/api/engineering/engineers',
    '/api/engineering/materials?category=manufactured',
    '/api/engineering/blueprints'
  ])
})

test('personal material transport validates the server-owned inventory read model', async () => {
  const request = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({
    schemaVersion: 1,
    updatedAt: null,
    stores: { shipLockerUpdatedAt: null, backpackUpdatedAt: null },
    groups: [
      { id: 'goods', label: 'Goods', items: [] },
      { id: 'assets', label: 'Assets', items: [] },
      { id: 'data', label: 'Data', items: [] },
      { id: 'consumables', label: 'Consumables', items: [] }
    ]
  }))

  await expect(new PhoenixApiClient('', request).getPersonalMaterialInventory())
    .resolves.toMatchObject({
      schemaVersion: 1,
      groups: expect.arrayContaining([expect.objectContaining({ id: 'goods' })])
    })
  expect(request.mock.calls[0]?.[0]).toBe('/api/equipment/materials')
})

test('personal equipment upgrade transport validates source-recorded recipes', async () => {
  const request = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({
    schemaVersion: 1,
    catalogueVersion: 'revision',
    generatedAt: '2026-09-15T00:00:00.000Z',
    sources: [{
      name: 'Test catalogue',
      repository: 'https://example.invalid/catalogue',
      revision: 'revision',
      license: 'CC0-1.0',
      retrievedAt: '2026-09-15T00:00:00.000Z'
    }],
    gradeUpgradePaths: [],
    modifications: []
  }))

  await expect(new PhoenixApiClient('', request).getPersonalEquipmentUpgrades())
    .resolves.toMatchObject({ schemaVersion: 1, catalogueVersion: 'revision' })
  expect(request.mock.calls[0]?.[0]).toBe('/api/equipment/upgrades')
})

test('personal equipment specialist transport validates source-recorded capabilities', async () => {
  const request = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({
    schemaVersion: 2,
    catalogueVersion: 'revision',
    generatedAt: '2026-09-15T00:00:00.000Z',
    sources: [{
      name: 'Test catalogue',
      repository: 'https://example.invalid/catalogue',
      revision: 'revision',
      license: 'CC0-1.0',
      retrievedAt: '2026-09-15T00:00:00.000Z'
    }],
    specialists: [{
      id: 'test-engineer',
      frontierEngineerId: 900002,
      name: 'Test Engineer',
      access: { state: 'unlocked', reportedStatus: 'Unlocked', evidence: 'elite_journal' },
      location: {
        systemName: 'Specialist System',
        systemAddress: 42,
        marketId: 128999999,
        distanceLy: 5,
        evidence: 'external_catalogue'
      },
      modifications: [{ id: 'suit_test', name: 'Test Modification', targetKind: 'suit', engineeringTechnology: null }]
    }]
  }))

  await expect(new PhoenixApiClient('', request).getPersonalEquipmentSpecialists())
    .resolves.toMatchObject({ schemaVersion: 2, specialists: [{ id: 'test-engineer' }] })
  expect(request.mock.calls[0]?.[0]).toBe('/api/equipment/specialists')
})

test('personal equipment planner transport sends a preview without persisting it', async () => {
  const request = vi.fn<typeof fetch>()
    .mockResolvedValueOnce(jsonResponse({
      schemaVersion: 1,
      catalogueVersion: 'revision',
      generatedAt: '2026-09-15T00:00:00.000Z',
      equipment: []
    }))
    .mockResolvedValueOnce(jsonResponse({
      schemaVersion: 1,
      catalogueVersion: 'revision',
      equipment: { id: 'test-suit', name: 'Test Suit', kind: 'suit', source: 'catalogue' },
      currentGrade: 1,
      targetGrade: 1,
      slots: { current: 0, target: 0, installed: 0, planned: 0, remaining: 0 },
      steps: [],
      materials: [],
      credits: { knownSubtotal: 0, total: 0, complete: true },
      specialists: [],
      unresolvedInstalledModifications: []
    }))
  const client = new PhoenixApiClient('', request)
  await client.getPersonalEquipmentPlannerOptions()
  await client.previewPersonalEquipmentPlan({
    source: { kind: 'catalogue', equipmentId: 'test-suit', currentGrade: 1 },
    targetGrade: 1,
    plannedModificationIds: []
  })
  expect(request.mock.calls[0]?.[0]).toBe('/api/equipment/planner')
  expect(request.mock.calls[1]?.[0]).toBe('/api/equipment/planner/preview')
  expect(request.mock.calls[1]?.[1]).toMatchObject({ method: 'POST' })
})

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    headers: { 'content-type': 'application/json' },
    status: 200
  })
}
