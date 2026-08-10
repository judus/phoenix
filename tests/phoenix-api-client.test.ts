import { expect, test } from 'vitest'
import { PhoenixApiClient } from '../apps/web/src/api/phoenix-api-client.js'

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
