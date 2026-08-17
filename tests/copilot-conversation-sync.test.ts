import { expect, test } from 'vitest'
import type { AiResult, AiRunOptions, AiStreamEvent } from '@jdu/llm-client'
import {
  CopilotConversationEventSchema,
  type CopilotConversationEvent
} from '@phoenix/contracts'
import type {
  CopilotText,
  CopilotTextRequest
} from '../apps/server/src/application/copilot-text-service.js'
import { PhoenixApplication } from '../apps/server/src/phoenix-application.js'
import { PhoenixApiClient } from '../apps/web/src/platform/api/phoenix-api-client.js'

test('active Copilot turns are broadcast to every conversation subscriber', async () => {
  const application = new PhoenixApplication({
    copilot: new StreamingCopilot(),
    databasePath: ':memory:',
    eliteDirectory: null,
    host: '127.0.0.1',
    port: 0
  })
  const address = await application.start()
  const baseUrl = `http://${address.host}:${address.port}`
  const client = new PhoenixApiClient(baseUrl)

  try {
    const subscription = await fetch(conversationStreamUrl(baseUrl, 'shared-chat'))
    expect(subscription.status).toBe(200)
    const received = readConversationEvents(subscription, 4)

    await client.streamCopilotMessage({
      clientId: 'desktop-client',
      conversationId: 'shared-chat',
      message: 'Status.',
      turnId: 'text-turn-1'
    }, () => {})

    await expect(received).resolves.toEqual([
      expect.objectContaining({
        clientId: 'desktop-client',
        source: 'text',
        turnId: 'text-turn-1',
        type: 'turn.started',
        userText: 'Status.'
      }),
      expect.objectContaining({
        final: false,
        text: 'All clear.',
        type: 'assistant.transcript'
      }),
      expect.objectContaining({
        final: true,
        text: 'All clear.',
        type: 'assistant.transcript'
      }),
      expect.objectContaining({ type: 'turn.completed' })
    ])
  } finally {
    await application.stop()
  }
})

test('Realtime browsers can relay active transcript events through PHOENIX', async () => {
  const application = new PhoenixApplication({
    copilot: null,
    copilotRealtime: null,
    databasePath: ':memory:',
    eliteDirectory: null,
    host: '127.0.0.1',
    port: 0
  })
  const address = await application.start()
  const baseUrl = `http://${address.host}:${address.port}`
  const client = new PhoenixApiClient(baseUrl)

  try {
    const event: CopilotConversationEvent = {
      clientId: 'microphone-client',
      conversationId: 'shared-chat',
      final: false,
      occurredAt: '2026-08-11T08:00:00.000Z',
      text: 'Approaching the station.',
      turnId: 'voice-turn-1',
      type: 'assistant.transcript'
    }

    await client.publishCopilotConversationEvent(event)
    const subscription = await fetch(conversationStreamUrl(baseUrl, 'shared-chat'))
    const received = readConversationEvents(subscription, 1)
    await expect(received).resolves.toEqual([event])
  } finally {
    await application.stop()
  }
})

function conversationStreamUrl (baseUrl: string, conversationId: string): string {
  return `${baseUrl}/api/copilot/conversations/${encodeURIComponent(conversationId)}/stream`
}

class StreamingCopilot implements CopilotText {
  public getHistory (): Promise<[]> { return Promise.resolve([]) }

  public run (request: CopilotTextRequest): Promise<AiResult> {
    return Promise.resolve(result(request.conversationId ?? 'generated-chat'))
  }

  public async *stream (
    request: CopilotTextRequest,
    _options?: AiRunOptions
  ): AsyncGenerator<AiStreamEvent, void, void> {
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
      createdAt: '2026-08-11T08:00:00.000Z',
      id: 'assistant-message',
      role: 'assistant'
    },
    text: 'All clear.',
    usage: { inputTokens: 2, outputTokens: 2 }
  }
}

async function readConversationEvents (
  response: Response,
  count: number
): Promise<CopilotConversationEvent[]> {
  if (!response.body) throw new Error('Conversation stream has no response body.')
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  const events: CopilotConversationEvent[] = []
  let buffered = ''
  try {
    while (events.length < count) {
      const chunk = await reader.read()
      if (chunk.done) break
      buffered += decoder.decode(chunk.value, { stream: true })
      let boundary = buffered.indexOf('\n\n')
      while (boundary >= 0) {
        const frame = buffered.slice(0, boundary)
        buffered = buffered.slice(boundary + 2)
        const type = frame.split('\n').find(line => line.startsWith('event: '))?.slice(7)
        const data = frame.split('\n').find(line => line.startsWith('data: '))?.slice(6)
        if (type === 'conversation-event' && data) {
          events.push(CopilotConversationEventSchema.parse(JSON.parse(data)))
        }
        boundary = buffered.indexOf('\n\n')
      }
    }
  } finally {
    await reader.cancel()
  }
  return events
}
