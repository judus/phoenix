import { expect, test, vi } from 'vitest'
import { ProviderQueryError } from '../apps/server/src/domain/provider-query-error.js'
import { fetchProviderJson } from '../apps/server/src/infrastructure/fetch-provider-json.js'
import { SpanshSearchClient } from '../apps/server/src/infrastructure/spansh-search-client.js'
import { ArdentStationSearchSource } from '../apps/server/src/infrastructure/ardent-station-search-source.js'
import { EdsmStationStockSource } from '../apps/server/src/infrastructure/edsm-station-stock-source.js'
import { EdsmCartographySource } from '../apps/server/src/infrastructure/edsm-cartography-source.js'

const privateUrl = new URL('https://provider.invalid/private-system?token=private-token')

test.each([
  [400, 'request_rejected'], [401, 'authentication'], [403, 'authorization'],
  [409, 'request_rejected'], [422, 'request_rejected'],
  [404, 'not_found'], [408, 'timeout'], [429, 'rate_limit'],
  [500, 'provider_unavailable'], [503, 'provider_unavailable'], [504, 'timeout']
])('HTTP %i becomes a safe typed %s failure without retrying', async (status, kind) => {
  const fetcher = vi.fn(async () => new Response('private response body', { status: Number(status) }))
  const request = fetchProviderJson('Spansh', fetcher as typeof fetch, privateUrl, {})
  await expect(request).rejects.toMatchObject({ name: 'ProviderQueryError', provider: 'Spansh', kind, status })
  await expect(request).rejects.not.toThrow(/private|token|invalid/)
  expect(fetcher).toHaveBeenCalledTimes(1)
})

test('network causes stay diagnostic and are not included in public messages', async () => {
  const cause = new TypeError(`Could not fetch ${privateUrl}`)
  const fetcher = vi.fn(async () => { throw cause })
  const error = await fetchProviderJson('Ardent', fetcher as typeof fetch, privateUrl, {}).catch(error => error)
  expect(error).toBeInstanceOf(ProviderQueryError)
  expect(error).toMatchObject({ kind: 'transport', cause, message: 'Ardent request could not be completed.' })
  expect(fetcher).toHaveBeenCalledTimes(1)
})

test('timeouts are classified by exact exception or aborted timeout signal, not arbitrary error text', async () => {
  const timeout = new DOMException('private timeout detail', 'TimeoutError')
  const aborted = new DOMException('private abort detail', 'AbortError')
  const controller = new AbortController()
  controller.abort(timeout)
  for (const [cause, signal, expected] of [
    [timeout, undefined, 'timeout'], [aborted, controller.signal, 'timeout'],
    [aborted, undefined, 'transport'], [new Error('timeout while accessing private system'), undefined, 'transport']
  ] as const) {
    const fetcher = async (): Promise<Response> => { throw cause }
    await expect(fetchProviderJson('EDSM', fetcher as typeof fetch, privateUrl, { signal }))
      .rejects.toMatchObject({ kind: expected, cause })
  }
})

test('invalid JSON is malformed while failed response-body transport remains transport', async () => {
  const invalidJson = async (): Promise<Response> => new Response('private non-JSON body')
  await expect(fetchProviderJson('EDSM', invalidJson as typeof fetch, privateUrl, {}))
    .rejects.toMatchObject({ kind: 'malformed_response', message: 'EDSM returned an invalid response.' })
  const cause = new TypeError('private socket failure')
  const response = new Response('{}')
  vi.spyOn(response, 'json').mockRejectedValue(cause)
  await expect(fetchProviderJson('EDSM', (async () => response) as typeof fetch, privateUrl, {}))
    .rejects.toMatchObject({ kind: 'transport', cause })
})

test('response-body timeout uses the same typed timeout classification', async () => {
  const cause = new DOMException('private timeout detail', 'TimeoutError')
  const response = new Response('{}')
  vi.spyOn(response, 'json').mockRejectedValue(cause)
  await expect(fetchProviderJson('EDSM', (async () => response) as typeof fetch, privateUrl, {}))
    .rejects.toMatchObject({ kind: 'timeout', cause })
})

test('all four concrete clients use the shared HTTP classification', async () => {
  const fetcher = vi.fn(async () => new Response('private response', { status: 429 })) as unknown as typeof fetch
  const spansh = new SpanshSearchClient({ fetch: fetcher })
  const ardent = new ArdentStationSearchSource({ fetch: fetcher, resolveCommodity: () => null })
  const stock = new EdsmStationStockSource({ fetch: fetcher })
  const cartography = new EdsmCartographySource({ fetch: fetcher })
  for (const [provider, request] of [
    ['Spansh', () => spansh.search('stations', { filters: {}, referencePosition: null })],
    ['Ardent', () => ardent.getCommodityReports()],
    ['EDSM', () => stock.getShipyard(123)], ['EDSM', () => cartography.fetchSystem('Sol')]
  ] as const) {
    await expect(request()).rejects.toMatchObject({ provider, kind: 'rate_limit', status: 429 })
  }
  expect(fetcher).toHaveBeenCalledTimes(6) // Cartography intentionally loads three different records concurrently.
})

test('Spansh rejects invalid search and field-values envelopes as malformed provider responses', async () => {
  const source = new SpanshSearchClient({ fetch: jsonFetch({ results: 'invalid', values: {} }) })
  await expect(source.search('stations', { filters: {}, referencePosition: null })).rejects.toMatchObject({ kind: 'malformed_response' })
  await expect(source.findFieldValues('stations', 'modules', 'cargo')).rejects.toMatchObject({ kind: 'malformed_response' })
})

test('Ardent rejects an invalid list envelope', async () => {
  const source = new ArdentStationSearchSource({ fetch: jsonFetch({ error: 'private' }), resolveCommodity: () => null })
  await expect(source.getCommodityReports()).rejects.toMatchObject({ provider: 'Ardent', kind: 'malformed_response' })
})

test.each([null, 42, { ships: 'private invalid payload' }])('EDSM stock rejects invalid response shape %j', async payload => {
  await expect(new EdsmStationStockSource({ fetch: jsonFetch(payload) }).getShipyard(123))
    .rejects.toMatchObject({ provider: 'EDSM', kind: 'malformed_response' })
})

test('EDSM stock keeps valid missing-stock and empty-stock fallbacks', async () => {
  await expect(new EdsmStationStockSource({ fetch: jsonFetch({}) }).getShipyard(123)).resolves.toEqual([])
  await expect(new EdsmStationStockSource({ fetch: jsonFetch({ outfitting: [] }) }).getOutfitting(123)).resolves.toEqual([])
})

test.each([{}, []])('empty EDSM cartography %j is not found, not an outage', async payload => {
  await expect(new EdsmCartographySource({ fetch: jsonFetch(payload) }).fetchSystem('Private unknown system'))
    .rejects.toMatchObject({ provider: 'EDSM', kind: 'not_found', message: 'EDSM has no matching record.' })
})

test.each([null, 42, ['invalid'], { error: 'private error' }, { bodies: 'invalid' }, { stations: {} }])('EDSM cartography rejects malformed envelopes %j', async payload => {
  await expect(new EdsmCartographySource({ fetch: jsonFetch(payload) }).fetchSystem('Sol'))
    .rejects.toMatchObject({ provider: 'EDSM', kind: 'malformed_response' })
})

test('partial EDSM cartography remains usable when another record supplies the system name', async () => {
  const source = new EdsmCartographySource({ fetch: (async input => {
    const path = new URL(String(input)).pathname
    return new Response(JSON.stringify(path.endsWith('/bodies') ? { name: 'Sol', bodies: [] } : {}))
  }) as typeof fetch })
  await expect(source.fetchSystem('Sol')).resolves.toMatchObject({ name: 'Sol', bodies: [], stations: [] })
})

function jsonFetch (payload: unknown): typeof fetch {
  return (async () => new Response(JSON.stringify(payload))) as typeof fetch
}
