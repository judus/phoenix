import { expect, test } from 'vitest'
import { CopilotVoiceHostCommandSchema } from '@phoenix/contracts'
import { PhoenixApplication } from '../apps/server/src/phoenix-application.js'
import { PhoenixApiClient } from '../apps/web/src/platform/api/phoenix-api-client.js'

test('a tablet can control an armed desktop voice host through PHOENIX', async () => {
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
    await client.updateCopilotVoiceHost({
      armed: true,
      clientId: 'desktop-browser',
      connected: true,
      hostId: 'desktop-browser',
      phase: 'listening'
    })

    await expect(client.getCopilotVoiceHost()).resolves.toMatchObject({
      desiredConnected: true,
      host: { connected: true, hostId: 'desktop-browser', phase: 'listening' }
    })

    const stream = await fetch(
      `http://${address.host}:${address.port}/api/copilot/voice-host/commands/stream?hostId=desktop-browser`
    )
    const commandPromise = readCommand(stream)
    const accepted = await client.requestCopilotVoiceHostState(false)

    expect(accepted.command.desiredConnected).toBe(false)
    await expect(commandPromise).resolves.toMatchObject({
      desiredConnected: false,
      hostId: 'desktop-browser'
    })

    await expect(client.updateCopilotVoiceHost({
      armed: true,
      clientId: 'desktop-browser',
      connected: true,
      hostId: 'desktop-browser',
      phase: 'listening'
    })).resolves.toMatchObject({ desiredConnected: false })
    await client.updateCopilotVoiceHost({
      armed: true,
      clientId: 'desktop-browser',
      connected: false,
      hostId: 'desktop-browser',
      phase: 'ready'
    })
    await expect(client.updateCopilotVoiceHost({
      armed: true,
      clientId: 'desktop-browser',
      connected: true,
      hostId: 'desktop-browser',
      phase: 'listening'
    })).resolves.toMatchObject({ desiredConnected: true })

    await client.releaseCopilotVoiceHost('desktop-browser')
    await expect(client.getCopilotVoiceHost()).resolves.toEqual({
      desiredConnected: false,
      host: null
    })
  } finally {
    await application.stop()
  }
})

test('remote voice control fails clearly when no desktop host is armed', async () => {
  const application = new PhoenixApplication({
    copilot: null,
    copilotRealtime: null,
    databasePath: ':memory:',
    eliteDirectory: null,
    host: '127.0.0.1',
    port: 0
  })
  const address = await application.start()

  try {
    await expect(
      new PhoenixApiClient(`http://${address.host}:${address.port}`)
        .requestCopilotVoiceHostState(true)
    ).rejects.toThrow('No armed desktop voice host is online.')
  } finally {
    await application.stop()
  }
})

async function readCommand (response: Response) {
  if (!response.body) throw new Error('Voice command stream has no response body.')
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffered = ''
  try {
    while (true) {
      const chunk = await reader.read()
      if (chunk.done) throw new Error('Voice command stream ended early.')
      buffered += decoder.decode(chunk.value, { stream: true })
      const boundary = buffered.indexOf('\n\n')
      if (boundary < 0) continue
      const frame = buffered.slice(0, boundary)
      buffered = buffered.slice(boundary + 2)
      const type = frame.split('\n').find(line => line.startsWith('event: '))?.slice(7)
      const data = frame.split('\n').find(line => line.startsWith('data: '))?.slice(6)
      if (type === 'voice-host-command' && data) {
        return CopilotVoiceHostCommandSchema.parse(JSON.parse(data))
      }
    }
  } finally {
    await reader.cancel()
  }
}
