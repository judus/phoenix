import { expect, test } from 'vitest'
import type { RuntimeState } from '@phoenix/contracts'
import { PhoenixApplication } from '../apps/server/src/phoenix-application.js'
import { PhoenixApiClient } from '../apps/web/src/api/phoenix-api-client.js'

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
  const reader = response.body?.getReader()

  try {
    expect(response.ok).toBe(true)
    expect(response.headers.get('content-type')).toContain('text/event-stream')
    if (!reader) throw new Error('Runtime-state stream has no readable body.')

    const initial = await readRuntimeStateEvent(reader)
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
        systemName: 'Shinrarta Dezhra',
        placeName: null
      }
    })

    const projected = await readRuntimeStateEvent(reader)
    expect(projected).toMatchObject({
      revision: 1,
      location: {
        state: 'in_space',
        systemName: 'Shinrarta Dezhra',
        placeName: null
      }
    })

    const snapshot = await new PhoenixApiClient(baseUrl).getRuntimeState()
    expect(snapshot).toEqual(projected)
  } finally {
    await reader?.cancel()
    await application.stop()
  }
})

async function readRuntimeStateEvent (
  reader: ReadableStreamDefaultReader<Uint8Array>
): Promise<RuntimeState> {
  const decoder = new TextDecoder()
  let buffered = ''

  while (!buffered.includes('\n\n')) {
    const result = await reader.read()
    if (result.done) throw new Error('Runtime-state stream ended unexpectedly.')
    buffered += decoder.decode(result.value, { stream: true })
  }

  const frame = buffered.slice(0, buffered.indexOf('\n\n'))
  const data = frame.split('\n').find(line => line.startsWith('data: '))
  if (!data) throw new Error('Runtime-state stream emitted a frame without data.')
  return JSON.parse(data.slice(6)) as RuntimeState
}
