import { readSseEvents } from './support/sse-events.js'
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
      appliedRevision: 0,
      armed: true,
      clientId: 'desktop-browser',
      connected: true,
      hostId: 'desktop-browser',
      phase: 'listening'
    })

    await expect(client.getCopilotVoiceHost()).resolves.toMatchObject({
      desiredConnected: true,
      desiredRevision: 0,
      host: { connected: true, hostId: 'desktop-browser', phase: 'listening' }
    })

    const stream = await fetch(
      `http://${address.host}:${address.port}/api/copilot/voice-host/commands/stream?hostId=desktop-browser`
    )
    const commandPromise = readCommand(stream)
    const accepted = await client.requestCopilotVoiceHostState(false)

    expect(accepted.command.desiredConnected).toBe(false)
    expect(accepted.command.revision).toBe(1)
    await expect(commandPromise).resolves.toMatchObject({
      desiredConnected: false,
      hostId: 'desktop-browser'
    })

    await expect(client.updateCopilotVoiceHost({
      appliedRevision: 0,
      armed: true,
      clientId: 'desktop-browser',
      connected: true,
      hostId: 'desktop-browser',
      phase: 'listening'
    })).resolves.toMatchObject({ desiredConnected: false })
    await client.updateCopilotVoiceHost({
      appliedRevision: 1,
      armed: true,
      clientId: 'desktop-browser',
      connected: false,
      hostId: 'desktop-browser',
      phase: 'ready'
    })
    await expect(client.updateCopilotVoiceHost({
      appliedRevision: 1,
      armed: true,
      clientId: 'desktop-browser',
      connected: true,
      hostId: 'desktop-browser',
      phase: 'listening'
    })).resolves.toMatchObject({ desiredConnected: true })

    await client.releaseCopilotVoiceHost('desktop-browser')
    await expect(client.getCopilotVoiceHost()).resolves.toEqual({
      desiredConnected: false,
      desiredRevision: 0,
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
  for await (const { event, data } of readSseEvents(response)) {
    if (event === 'voice-host-command') return CopilotVoiceHostCommandSchema.parse(JSON.parse(data))
  }
  throw new Error('Voice command stream ended early.')
}
