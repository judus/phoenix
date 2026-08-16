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
        pairingRequired: true
      }))
      .mockResolvedValueOnce(jsonResponse({
        authenticated: true,
        installationId: 'installation-1',
        pairingRequired: true
      }))
    const client = new PhoenixApiClient('', request)

    await expect(client.getPairingStatus()).resolves.toMatchObject({ authenticated: false })
    await expect(client.claimPairing('ABCDE-12345')).resolves.toMatchObject({ authenticated: true })

    expect(request).toHaveBeenNthCalledWith(1, '/api/pairing/status', expect.objectContaining({
      credentials: 'same-origin'
    }))
    expect(request).toHaveBeenNthCalledWith(2, '/api/pairing/claim', expect.objectContaining({
      body: JSON.stringify({ code: 'ABCDE-12345' }),
      credentials: 'same-origin',
      method: 'POST'
    }))
  })

  test('rejects malformed pairing evidence', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ authenticated: true }))
    await expect(new PhoenixApiClient('', request).getPairingStatus()).rejects.toThrow()
  })
})

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    headers: { 'content-type': 'application/json' },
    status: 200
  })
}
