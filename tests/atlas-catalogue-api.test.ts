import { expect, test } from 'vitest'
import { RecordingKeyboardOutput } from 'control-deck/adapter-keyboard'
import { PhoenixApplication } from '../apps/server/src/phoenix-application.js'
import { PhoenixApiClient } from '../apps/web/src/platform/api/phoenix-api-client.js'
import { StaticEliteDangerousBindings } from './support/static-elite-dangerous-bindings.js'

test('Atlas API exposes cached source records and curated Live site coordinates', async () => {
  const application = new PhoenixApplication({
    eliteBindings: new StaticEliteDangerousBindings(), databasePath: ':memory:', eliteDirectory: null,
    host: '127.0.0.1', keyboardOutput: new RecordingKeyboardOutput(), port: 0,
    atlasSources: [{ id: 'synthetic', name: 'Synthetic feed', url: 'https://example.com/pois', licence: null, getPois: async () => ({
      pois: [{ id: 'synthetic:1', label: 'Synthetic site', systemName: 'Example', position: [10, 20, 30], categories: ['Historical'], source: 'Synthetic feed', sourceUrl: 'https://example.com/site' }], rejected: 0
    }) }]
  })
  const address = await application.start()
  const client = new PhoenixApiClient(`http://${address.host}:${address.port}`)
  try {
    const response = await client.getAtlasCatalogue()
    expect(response.pois).toHaveLength(2)
    expect(response.pois.find(poi => poi.id === 'canonn:jameson-crash-site')).toMatchObject({
      systemName: 'HIP 12099', bodyName: '1 b', surface: { latitude: -54.3735, longitude: -50.3516 }
    })
    expect(response.sources[0]?.cache).toBe('refreshed')
    expect((await client.getAtlasCatalogue()).sources[0]?.cache).toBe('fresh')
  } finally { await application.stop() }
})
