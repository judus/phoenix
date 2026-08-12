import { expect, test } from 'vitest'
import type { AiResult, AiRunOptions, AiStreamEvent } from '@judus/llm-client'
import type {
  CopilotText,
  CopilotTextRequest
} from '../apps/server/src/application/copilot-text-service.js'
import { PhoenixApplication } from '../apps/server/src/phoenix-application.js'
import { PhoenixApiClient } from '../apps/web/src/api/phoenix-api-client.js'

test('the Copilot API supports buffered and streamed text turns', async () => {
  const copilot = new RecordingCopilot()
  const application = new PhoenixApplication({
    copilot,
    databasePath: ':memory:',
    eliteDirectory: null,
    host: '127.0.0.1',
    port: 0
  })
  const address = await application.start()
  const baseUrl = `http://${address.host}:${address.port}`
  const endpoint = `${baseUrl}/api/copilot/chat`
  const client = new PhoenixApiClient(baseUrl)

  try {
    const buffered = await fetch(endpoint, {
      body: JSON.stringify({ message: ' Status report. ', profileId: 'marin' }),
      headers: { 'content-type': 'application/json' },
      method: 'POST'
    })
    expect(buffered.status).toBe(200)
    await expect(buffered.json()).resolves.toMatchObject({
      conversationId: 'generated-chat',
      finishReason: 'stop',
      text: 'All clear.'
    })

    await expect(client.getCopilotHistory('generated-chat')).resolves.toMatchObject({
      conversationId: 'generated-chat',
      messages: [{ role: 'assistant', text: 'All clear.' }]
    })

    const invalid = await fetch(endpoint, {
      body: JSON.stringify({ message: '   ' }),
      headers: { 'content-type': 'application/json' },
      method: 'POST'
    })
    expect(invalid.status).toBe(400)
    await expect(invalid.json()).resolves.toMatchObject({
      error: { code: 'invalid_copilot_request' }
    })

    const events: string[] = []
    await client.streamCopilotMessage(
      { conversationId: 'bridge-log', message: 'Continue.' },
      event => events.push(event.type)
    )
    expect(events).toEqual(['started', 'delta', 'completed'])
    expect(copilot.requests).toEqual([
      { message: 'Status report.', profileId: 'marin' },
      { conversationId: 'bridge-log', message: 'Continue.' }
    ])
  } finally {
    await application.stop()
  }
})

test('the Copilot API reports invalid requests and disabled configuration', async () => {
  const application = new PhoenixApplication({
    copilot: null,
    databasePath: ':memory:',
    eliteDirectory: null,
    host: '127.0.0.1',
    port: 0
  })
  const address = await application.start()

  try {
    const response = await fetch(`http://${address.host}:${address.port}/api/copilot/chat`, {
      body: JSON.stringify({ message: 'Hello.' }),
      headers: { 'content-type': 'application/json' },
      method: 'POST'
    })
    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'copilot_unavailable' }
    })
  } finally {
    await application.stop()
  }
})

class RecordingCopilot implements CopilotText {
  public readonly requests: CopilotTextRequest[] = []

  public getHistory (conversationId: string) {
    return Promise.resolve([{
      createdAt: '2026-08-10T20:00:00.000Z',
      id: `${conversationId}-assistant`,
      role: 'assistant' as const,
      text: 'All clear.'
    }])
  }

  public run (request: CopilotTextRequest, _options?: AiRunOptions): Promise<AiResult> {
    this.requests.push(request)
    return Promise.resolve(result(request.conversationId ?? 'generated-chat'))
  }

  public async *stream (
    request: CopilotTextRequest,
    _options?: AiRunOptions
  ): AsyncGenerator<AiStreamEvent, void, void> {
    this.requests.push(request)
    const chatId = request.conversationId ?? 'generated-chat'
    yield { chatId, type: 'run.started' }
    yield { delta: 'All clear.', type: 'text.delta' }
    yield { result: result(chatId), type: 'run.completed' }
  }
}

function result (chatId: string): AiResult {
  return {
    chatId,
    finishReason: 'stop',
    message: {
      content: [{ source: 'generated', text: 'All clear.', type: 'text' }],
      conversationId: chatId,
      createdAt: '2026-08-10T20:00:00.000Z',
      id: 'assistant-message',
      role: 'assistant'
    },
    text: 'All clear.',
    usage: { inputTokens: 10, outputTokens: 3 }
  }
}
