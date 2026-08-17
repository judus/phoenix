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
  if (!response.body) throw new Error('PHOENIX event stream has no response body.')
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  const names: string[] = []
  let buffered = ''
  try {
    while (names.length < count) {
      const chunk = await reader.read()
      if (chunk.done) break
      buffered += decoder.decode(chunk.value, { stream: true })
      let boundary = buffered.indexOf('\n\n')
      while (boundary >= 0) {
        const frame = buffered.slice(0, boundary)
        buffered = buffered.slice(boundary + 2)
        const name = frame.split('\n').find(line => line.startsWith('event: '))?.slice(7)
        if (name) names.push(name)
        boundary = buffered.indexOf('\n\n')
      }
    }
  } finally {
    await reader.cancel()
  }
  return names
}
