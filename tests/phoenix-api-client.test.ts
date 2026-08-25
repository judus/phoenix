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

test('filtered Galaxy search serializes typed parameters and validates the response', async () => {
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

  await expect(new PhoenixApiClient('', request).getFilteredSystems({
    economy: 'High Tech',
    maxDistance: 75,
    minPopulation: 1,
    population: 'inhabited',
    system: 'Sol'
  })).resolves.toMatchObject({ originSystem: 'Sol', systems: [] })

  expect(request.mock.calls[0]?.[0]).toBe('/api/galaxy/systems/search?maxDistance=75&population=inhabited&system=Sol&economy=High+Tech&minPopulation=1')
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
    .mockResolvedValueOnce(jsonResponse({ articles: [], cache: 'fresh', fetchedAt: '2026-08-16T12:00:00.000Z' }))
  const client = new PhoenixApiClient('', request)

  await expect(client.getCommunications('traffic', 25)).resolves.toMatchObject({ messages: [], view: 'traffic' })
  await expect(client.getGalnetNews(10)).resolves.toMatchObject({ articles: [], cache: 'fresh' })
  expect(request.mock.calls[0]?.[0]).toBe('/api/comms/messages?limit=25&view=traffic')
  expect(request.mock.calls[1]?.[0]).toBe('/api/galnet?limit=10')
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

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    headers: { 'content-type': 'application/json' },
    status: 200
  })
}
