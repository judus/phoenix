import { expect, test } from 'vitest'
import { RuntimeStateSchema } from '@phoenix/contracts'
import { readSseEvents } from './support/sse-events.js'
import { PhoenixApplication } from '../apps/server/src/phoenix-application.js'
import { PhoenixApiClient } from '../apps/web/src/platform/api/phoenix-api-client.js'

test('connected clients receive the initial and projected runtime snapshots', async () => {
  const application = new PhoenixApplication({
    databasePath: ':memory:',
    eliteDirectory: null,
    host: '127.0.0.1',
    port: 0
  })
  const address = await application.start()
  const baseUrl = `http://${address.host}:${address.port}`
  const response = await fetch(`${baseUrl}/api/runtime-state/stream`)
  const events = readSseEvents(response)

  try {
    expect(response.ok).toBe(true)
    expect(response.headers.get('content-type')).toContain('text/event-stream')
    const first = await events.next()
    expect(first.value?.event).toBe('runtime-state')
    const initial = RuntimeStateSchema.parse(JSON.parse(first.value!.data))
    expect(initial).toMatchObject({ revision: 0, location: { state: 'unknown' } })

    application.ingestGameEvent({
      schemaVersion: 1,
      id: 'synthetic-location-2',
      type: 'location.changed',
      gameTimestamp: '2026-08-10T12:00:00.000Z',
      ingestedAt: '2026-08-10T12:00:01.000Z',
      source: 'synthetic',
      payload: {
        state: 'in_space',
        place: null
      }
    })

    const next = await events.next()
    expect(next.value?.event).toBe('runtime-state')
    const projected = RuntimeStateSchema.parse(JSON.parse(next.value!.data))
    expect(projected).toMatchObject({
      revision: 1,
      location: {
        state: 'in_space',
        place: null
      }
    })

    const snapshot = await new PhoenixApiClient(baseUrl).getRuntimeState()
    expect(snapshot).toEqual(projected)
  } finally {
    await events.return()
    await application.stop()
  }
})
