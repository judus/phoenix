import { readSseEvents } from './support/sse-events.js'
import { expect, test } from 'vitest'
import { PhoenixApplication } from '../apps/server/src/phoenix-application.js'
import { PhoenixApiClient } from '../apps/web/src/platform/api/phoenix-api-client.js'

test('the shared browser stream multiplexes runtime, route, command catalogue, and voice-host state', async () => {
  const application = new PhoenixApplication({
    copilot: null,
    copilotRealtime: null,
    databasePath: ':memory:',
    eliteDirectory: null,
    host: '127.0.0.1',
    port: 0
  })
  const address = await application.start()
  const client = new PhoenixApiClient(`http://${address.host}:${address.port}`)

  try {
    const response = await fetch(client.eventStreamUrl())
    await expect(readEventNames(response, 4)).resolves.toEqual([
      'runtime-state',
      'navigation-route',
      'command-catalogue',
      'voice-host'
    ])
  } finally {
    await application.stop()
  }
})

async function readEventNames (response: Response, count: number): Promise<string[]> {
  const names: string[] = []
  for await (const { event } of readSseEvents(response)) {
    names.push(event)
    if (names.length === count) break
  }
  return names
}
