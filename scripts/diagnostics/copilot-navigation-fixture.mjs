// Synthetic inference, real MCP tools and llm-client persistence. No external requests.
import { createAiClient, InMemoryConversationStore } from '@jdu/llm-client'
import { textModelCapabilities } from '@jdu/llm-client/testing'
import { setTimeout } from 'node:timers/promises'

export function createNavigationCopilot(origin) {
  const repository = new InMemoryConversationStore()
  let sequence = 0
  const provider = {
    id: 'synthetic', model: 'navigation-fixture',
    async capabilities() {
      return { ...textModelCapabilities(), tools: { calls: true, parallelCalls: true, strictSchemas: true } }
    },
    async *stream(request, options) {
      const last = request.messages.at(-1)
      const showAtlas = last.role === 'user' && last.content.some(part => part.type === 'text' && part.text.includes('Show Colonia'))
      const text = last.role === 'tool' ? 'Here is Colonia.'
        : request.messages.some(message => message.role === 'assistant' && message.content.some(part => part.type === 'text' && part.text === 'Here is Colonia.'))
          ? 'I remember showing Colonia.' : 'Synthetic response.'
      yield { type: 'model.request.started', sequence: 0 }
      if (!showAtlas) await setTimeout(3000, undefined, { signal: options?.signal })
      const id = `synthetic-${++sequence}`
      yield { type: 'model.response.completed', sequence: 1, response: {
        id, finishReason: showAtlas ? 'tool_calls' : 'stop',
        message: { id, role: 'assistant', conversationId: 'phoenix-copilot', createdAt: new Date().toISOString(),
          content: showAtlas ? [{ type: 'tool_call', arguments: { systemName: 'Colonia' }, callId: id, name: 'phoenix__display_show_galactic_atlas' }]
            : [{ type: 'text', source: 'generated', text }] },
        model: { model: 'navigation-fixture', provider: 'synthetic' }, usage: { inputTokens: 1, outputTokens: 1 }
      } }
    }
  }
  const chat = request => createAiClient({ provider, history: { repository }, mcp: [{ name: 'phoenix', url: `${origin()}/mcp` }] })
    .chat(request.conversationId ?? 'phoenix-copilot').user(request.message)
  return {
    run: (request, options) => chat(request).run(options),
    stream: (request, options) => chat(request).stream(options),
    async getHistory(id) {
      return (await repository.snapshot(id))?.messages.flatMap(message => {
        const text = message.content.filter(part => part.type === 'text').map(part => part.text).join('\n').trim()
        return text ? [{ id: message.id, createdAt: message.createdAt, role: message.role, text }] : []
      }) ?? []
    }
  }
}
