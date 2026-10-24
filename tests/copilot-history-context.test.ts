import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, test, vi } from 'vitest'
import { MockLanguageModelV3 } from 'ai/test'
import { InMemoryConversationStore, ToolRegistry, type ConversationMessage, type ConversationStore } from '@jdu/llm-client'
import { AiSdkCopilotClientFactory } from '../apps/server/src/infrastructure/ai-sdk-copilot-client.js'
import { activeCopilotHistory, CopilotHistoryContext } from '../apps/server/src/infrastructure/copilot-history-context.js'
import { JsonConversationStore } from '../apps/server/src/infrastructure/json-conversation-store.js'

const usage = { inputTokens: { total: 2, noCache: 2, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 3, text: 3, reasoning: 0 } }
const directories: string[] = []
afterEach(async () => { for (const directory of directories.splice(0)) await rm(directory, { recursive: true, force: true }) })
const answer = () => ({ stream: new ReadableStream({ start (controller) {
  controller.enqueue({ type: 'text-start', id: 'answer' })
  controller.enqueue({ type: 'text-delta', id: 'answer', delta: 'Continued.' })
  controller.enqueue({ type: 'text-end', id: 'answer' })
  controller.enqueue({ type: 'finish', finishReason: { unified: 'stop', raw: 'stop' }, usage })
  controller.close()
} }) })
function summary (text = 'Commander prefers exploration. Completed actions must not be repeated. An unresolved effect remains unknown.') {
  return { content: [{ type: 'text' as const, text }], finishReason: { unified: 'stop' as const, raw: 'stop' }, usage, warnings: [] }
}
function message (id: string, role: ConversationMessage['role'], text: string, metadata?: ConversationMessage['metadata']): ConversationMessage {
  return { id, conversationId: 'chat', createdAt: '2026-10-24T00:00:00Z', role,
    content: [{ type: 'text', text, source: 'typed' }], ...(metadata ? { metadata } : {}) }
}
async function seed (store: ConversationStore, turns = 24, length = 1000) {
  const conversation = await store.create({ id: 'chat' })
  const messages = Array.from({ length: turns }, (_, index) => [
    message(`user-${index}`, 'user', `Old request ${index}: ${'x'.repeat(length)}`),
    message(`assistant-${index}`, 'assistant', `Old answer ${index}.`)
  ]).flat()
  const saved = await store.append('chat', messages, { expectedRevision: conversation.revision })
  return { messages, saved }
}
function client (model: MockLanguageModelV3, conversations: ConversationStore, tools = new ToolRegistry(), maxContextTokens = 16_000) {
  return new AiSdkCopilotClientFactory({ model, conversations, tools, maxContextTokens }).create('Current authoritative instructions.')
}

test('legacy checkpoint selects its covered source boundary and retains recent turns before its append position', () => {
  const history = [message('first', 'user', 'First'), message('first-answer', 'assistant', 'First answer'),
    message('recent', 'user', 'Recent'), message('recent-answer', 'assistant', 'Recent answer'),
    message('summary', 'developer', 'Summary', { historySummary: { lastSourceMessageId: 'first-answer', sourceMessagesRetained: true } }),
    message('new', 'user', 'New')]
  expect(activeCopilotHistory(history).map(message => message.id)).toEqual(['summary', 'recent', 'recent-answer', 'new'])
  expect(history).toHaveLength(6)
})

test('existing summaries prevent a large archived transcript being sent again without another paid summary', async () => {
  const conversations = new InMemoryConversationStore()
  const seeded = await seed(conversations, 300)
  await conversations.append('chat', [message('recent', 'user', 'Remember recent request'),
    message('recent-answer', 'assistant', 'Recent answer'), message('summary', 'developer', 'Previously summarized facts', {
      historySummary: { lastSourceMessageId: seeded.messages.at(-1)!.id, sourceMessagesRetained: true }
    })], { expectedRevision: seeded.saved.revision })
  const model = new MockLanguageModelV3({ doStream: async () => answer(), doGenerate: async () => { throw new Error('Unnecessary summarization') } })
  expect((await client(model, conversations).chat('chat').user('Continue').run()).text).toBe('Continued.')
  expect(model.doGenerateCalls).toHaveLength(0)
  const prompt = JSON.stringify(model.doStreamCalls[0].prompt)
  expect(prompt).toContain('Previously summarized facts')
  expect(prompt).toContain('Remember recent request')
  expect(prompt).not.toContain('Old request 0:')
  expect((await conversations.snapshot('chat'))?.messages.slice(0, seeded.messages.length)).toEqual(seeded.messages)
})

test('rolling summaries batch old turns, preserve archive and recent context, then survive reopening', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'phoenix-summary-'))
  directories.push(directory)
  const conversations = new JsonConversationStore(directory)
  const seeded = await seed(conversations, 40)
  const model = new MockLanguageModelV3({ doGenerate: async () => summary(), doStream: async () => answer() })
  const result = await client(model, conversations).chat('chat').user('Continue the plan').run()
  expect(result.text).toBe('Continued.')
  expect(model.doGenerateCalls.length).toBeGreaterThan(1)
  expect(result.usage.inputTokens).toBe(2 * (model.doGenerateCalls.length + 1))
  for (const request of model.doGenerateCalls) {
    expect(request.tools ?? []).toHaveLength(0)
    expect(Buffer.byteLength(JSON.stringify(request.prompt)) + 4096).toBeLessThan(16_000)
    expect(request.abortSignal).toBeDefined()
  }
  const prompt = JSON.stringify(model.doStreamCalls[0].prompt)
  expect(prompt).toContain('Current authoritative instructions.')
  expect(prompt).toContain('Commander prefers exploration')
  expect(prompt).toContain('Continue the plan')
  expect(prompt).toContain('Old request 39:')
  expect(prompt).not.toContain('Old request 0:')
  const reopened = new JsonConversationStore(directory)
  const saved = await reopened.snapshot('chat')
  expect(saved?.messages.slice(0, seeded.messages.length)).toEqual(seeded.messages)
  expect(saved?.messages.filter(message => message.metadata?.historySummary)).toHaveLength(model.doGenerateCalls.length)
  const before = model.doGenerateCalls.length
  await client(model, reopened).chat('chat').user('And then?').run()
  expect(model.doGenerateCalls).toHaveLength(before)
  expect(JSON.stringify(model.doStreamCalls.at(-1)!.prompt)).toContain('Continue the plan')
})

test.each(['empty', 'incomplete', 'oversized'] as const)('invalid %s summary leaves source history intact and does not enter the conversation model', async kind => {
  const conversations = new InMemoryConversationStore()
  const seeded = await seed(conversations)
  const model = new MockLanguageModelV3({ doGenerate: async () => kind === 'incomplete'
    ? { ...summary(), finishReason: { unified: 'length', raw: 'length' } }
    : summary(kind === 'empty' ? ' ' : 'x'.repeat(3000)), doStream: async () => answer() })
  await expect(client(model, conversations).chat('chat').user('Continue').run()).rejects.toMatchObject({ code: 'copilot_summary_invalid' })
  const saved = (await conversations.snapshot('chat'))!.messages
  expect(saved.slice(0, seeded.messages.length)).toEqual(seeded.messages)
  expect(saved.some(message => message.metadata?.historySummary)).toBe(false)
  expect(model.doStreamCalls).toHaveLength(0)
})

test('summary provider failure releases the turn and preserves history for a deliberate retry', async () => {
  const conversations = new InMemoryConversationStore()
  const seeded = await seed(conversations)
  let fail = true
  const model = new MockLanguageModelV3({ doGenerate: async () => { if (fail) throw new Error('Offline'); return summary() }, doStream: async () => answer() })
  const copilot = client(model, conversations)
  await expect(copilot.chat('chat').user('Continue').run()).rejects.toMatchObject({ code: 'copilot_summary_failed' })
  expect(model.doGenerateCalls).toHaveLength(1)
  expect((await conversations.snapshot('chat'))?.messages.slice(0, seeded.messages.length)).toEqual(seeded.messages)
  fail = false
  await expect(copilot.chat('chat').user('Retry').run()).resolves.toMatchObject({ text: 'Continued.' })
})

test('cancellation while summarizing writes no checkpoint and executes no tools', async () => {
  const conversations = new InMemoryConversationStore()
  await seed(conversations)
  const controller = new AbortController()
  const model = new MockLanguageModelV3({ doGenerate: async () => { controller.abort(); return summary() }, doStream: async () => answer() })
  const effect = vi.fn(() => ({}))
  const tools = new ToolRegistry([{ definition: { name: 'effect', description: 'Synthetic', inputSchema: { type: 'object' } }, execute: effect }])
  await expect(client(model, conversations, tools).chat('chat').user('Continue').run({ signal: controller.signal })).rejects.toThrow()
  expect(effect).not.toHaveBeenCalled()
  expect(model.doStreamCalls).toHaveLength(0)
  expect((await conversations.snapshot('chat'))?.messages.some(message => message.metadata?.historySummary)).toBe(false)
})

test('checkpoint persistence failure cannot discard source history or proceed with an unsaved summary', async () => {
  const conversations = new InMemoryConversationStore()
  const seeded = await seed(conversations)
  const append = conversations.append.bind(conversations)
  vi.spyOn(conversations, 'append').mockImplementation(async (id, messages, options) => {
    if (messages.some(message => message.metadata?.historySummary)) throw new Error('Synthetic save failure')
    return append(id, messages, options)
  })
  const model = new MockLanguageModelV3({ doGenerate: async () => summary(), doStream: async () => answer() })
  await expect(client(model, conversations).chat('chat').user('Continue').run()).rejects.toThrow('Synthetic save failure')
  expect((await conversations.snapshot('chat'))?.messages.slice(0, seeded.messages.length)).toEqual(seeded.messages)
  expect(model.doStreamCalls).toHaveLength(0)
})

test('invalid persisted checkpoint fails before provider or effects instead of silently dropping history', () => {
  expect(() => activeCopilotHistory([message('summary', 'developer', 'Summary', {
    historySummary: { lastSourceMessageId: 'missing', sourceMessagesRetained: true }
  })])).toThrow('source boundary')
})

test('summary coverage cannot cut through a pending tool call/result pair', () => {
  const call: ConversationMessage = { ...message('call', 'assistant', ''), content: [
    { type: 'tool_call', callId: 'pending', name: 'ship.status', arguments: {} }
  ] }
  expect(() => activeCopilotHistory([call, message('summary', 'developer', 'Summary', {
    historySummary: { lastSourceMessageId: 'call', sourceMessagesRetained: true }
  })])).toThrow('unsettled tool exchange')
})

test('legacy midpoint checkpoint restores the whole overlapping question/answer turn', () => {
  const history = [message('question', 'user', 'Question'), message('answer', 'assistant', 'Answer'),
    message('summary', 'developer', 'Summary', { historySummary: { lastSourceMessageId: 'question', sourceMessagesRetained: true } }),
    message('next', 'user', 'Continue')]
  expect(activeCopilotHistory(history).map(message => message.id)).toEqual(['summary', 'question', 'answer', 'next'])
})

test('legacy settled-tool midpoint retains its entire source turn including the uncovered final answer', () => {
  const call: ConversationMessage = { ...message('call', 'assistant', ''), content: [
    { type: 'tool_call', callId: 'effect', name: 'ship.status', arguments: {} }
  ] }
  const result: ConversationMessage = { ...message('result', 'tool', ''), content: [
    { type: 'tool_result', callId: 'effect', status: 'success', content: [] }
  ] }
  const history = [message('question', 'user', 'Question'), call, result,
    message('answer', 'assistant', 'Answer'), message('summary', 'developer', 'Summary', {
      historySummary: { lastSourceMessageId: 'result', sourceMessagesRetained: true }
    }), message('next', 'user', 'Continue')]
  expect(activeCopilotHistory(history).map(message => message.id)).toEqual(['summary', 'question', 'call', 'result', 'answer', 'next'])
})

test('a tool-calling summary is rejected without executing the effect or entering the main model', async () => {
  const conversations = new InMemoryConversationStore()
  await seed(conversations)
  const effect = vi.fn(() => ({}))
  const tools = new ToolRegistry([{ definition: { name: 'effect', description: 'Synthetic', inputSchema: { type: 'object' } }, execute: effect }])
  const model = new MockLanguageModelV3({ doGenerate: async () => ({ ...summary(), content: [
    { type: 'tool-call', toolCallId: 'forbidden', toolName: 'phoenix_effect', input: '{}' }
  ], finishReason: { unified: 'tool-calls', raw: 'tool_calls' } }), doStream: async () => answer() })
  await expect(client(model, conversations, tools).chat('chat').user('Continue').run()).rejects.toMatchObject({ code: 'copilot_summary_invalid' })
  expect(model.doGenerateCalls[0].tools ?? []).toHaveLength(0)
  expect(effect).not.toHaveBeenCalled()
  expect(model.doStreamCalls).toHaveLength(0)
  expect((await conversations.snapshot('chat'))?.messages.some(message => message.metadata?.historySummary)).toBe(false)
})

test('genuine saved instructions stay in the instruction channel, separate from historical summary data', async () => {
  const conversations = new InMemoryConversationStore()
  const seeded = await seed(conversations, 2, 20)
  await conversations.append('chat', [message('saved-instruction', 'developer', 'Retain this genuine instruction.'),
    message('summary', 'developer', 'Quoted historical context', { historySummary: {
      lastSourceMessageId: seeded.messages.at(-1)!.id, sourceMessagesRetained: true
    } })], { expectedRevision: seeded.saved.revision })
  const model = new MockLanguageModelV3({ doGenerate: async () => summary(), doStream: async () => answer() })
  await client(model, conversations).chat('chat').user('Continue').run()
  const instructions = model.doStreamCalls[0].prompt.filter(message => message.role === 'system')
  expect(instructions.map(message => message.content)).toEqual(['Retain this genuine instruction.', 'Current authoritative instructions.'])
  expect(JSON.stringify(instructions)).not.toContain('Quoted historical context')
})

test('partial batch failure leaves a usable exact checkpoint and all uncovered history for retry', async () => {
  const conversations = new InMemoryConversationStore()
  const seeded = await seed(conversations, 40)
  let requests = 0
  let fail = true
  const model = new MockLanguageModelV3({ doGenerate: async () => {
    if (++requests === 2 && fail) throw new Error('Second batch failed')
    return summary()
  }, doStream: async () => answer() })
  await expect(client(model, conversations).chat('chat').user('Continue').run()).rejects.toMatchObject({ code: 'copilot_summary_failed' })
  const saved = (await conversations.snapshot('chat'))!.messages
  expect(saved.slice(0, seeded.messages.length)).toEqual(seeded.messages)
  expect(saved.filter(message => message.metadata?.historySummary)).toHaveLength(1)
  const active = activeCopilotHistory(saved)
  expect(active.at(-1)?.content).toMatchObject([{ text: 'Continue' }])
  expect(model.doStreamCalls).toHaveLength(0)
  fail = false
  await expect(client(model, conversations).chat('chat').user('Retry').run()).resolves.toMatchObject({ text: 'Continued.' })
  expect((await conversations.snapshot('chat'))?.messages.slice(0, seeded.messages.length)).toEqual(seeded.messages)
})

test('retained tool exchanges keep opaque provider reasoning; summarized unknown effects never execute again', async () => {
  const conversations = new InMemoryConversationStore()
  const seeded = await seed(conversations)
  const oldCall: ConversationMessage = { ...message('old-call', 'assistant', ''), content: [
    { type: 'tool_call', callId: 'old-effect', name: 'ship.status', arguments: {} }
  ] }
  const oldResult: ConversationMessage = { ...message('old-result', 'tool', ''), content: [
    { type: 'tool_result', callId: 'old-effect', status: 'error', content: [], structuredContent: { outcome: 'unknown' },
      error: { code: 'unknown', message: 'Do not repeat automatically.', retryable: false } }
  ] }
  const middle = Array.from({ length: 24 }, (_, index) => [message(`middle-user-${index}`, 'user', 'x'.repeat(1000)),
    message(`middle-answer-${index}`, 'assistant', 'Middle answer')]).flat()
  const recentCall: ConversationMessage = { ...message('recent-call', 'assistant', ''), content: [
    { type: 'tool_call', callId: 'recent-effect', name: 'ship.status', arguments: {} }
  ], metadata: { sdkMessages: [{ role: 'assistant', content: [
    { type: 'reasoning', text: 'Provider reasoning', providerOptions: { anthropic: { signature: 'opaque-signature' } } },
    { type: 'tool-call', toolCallId: 'recent-effect', toolName: 'phoenix_ship_status', input: {} }
  ] }] } }
  const recentResult: ConversationMessage = { ...message('recent-result', 'tool', ''), content: [
    { type: 'tool_result', callId: 'recent-effect', status: 'success', content: [], structuredContent: { fuel: 7 } }
  ] }
  await conversations.append('chat', [message('old-user', 'user', 'Old effect'), oldCall, oldResult,
    message('old-answer', 'assistant', 'Its outcome is unknown.'), ...middle,
    message('recent-user', 'user', 'Recent status'), recentCall, recentResult, message('recent-answer', 'assistant', 'Fuel is seven.'),
    message('legacy-summary', 'developer', 'Old effect remains unknown; do not repeat automatically.', {
      historySummary: { lastSourceMessageId: 'old-result', sourceMessagesRetained: true }
    })],
  { expectedRevision: seeded.saved.revision })
  const effect = vi.fn(() => ({}))
  const tools = new ToolRegistry([{ definition: { name: 'ship.status', description: 'Synthetic', inputSchema: { type: 'object' } }, execute: effect }])
  const model = new MockLanguageModelV3({ doGenerate: async () => summary(), doStream: async () => answer() })
  await client(model, conversations, tools).chat('chat').user('Explain the current plan').run()
  expect(effect).not.toHaveBeenCalled()
  expect(JSON.stringify(model.doGenerateCalls)).toContain('Do not repeat automatically.')
  const prompt = JSON.stringify(model.doStreamCalls[0].prompt)
  expect(prompt).toContain('opaque-signature')
  expect(prompt).toContain('recent-effect')
  expect(prompt).not.toContain('old-effect')
  expect(model.doStreamCalls[0].prompt.find(message => message.role === 'user')?.content).toEqual(expect.arrayContaining([
    expect.objectContaining({ type: 'text', text: expect.stringContaining('historical_conversation_summary') })
  ]))
})

test('a single oversized older turn fails explicitly without truncation or a nonexistent new-chat instruction', async () => {
  const conversations = new InMemoryConversationStore()
  const seeded = await seed(conversations, 1, 20_000)
  await conversations.append('chat', [message('recent-small', 'user', 'Recent small request'),
    message('recent-small-answer', 'assistant', 'Recent small answer')], { expectedRevision: seeded.saved.revision })
  const model = new MockLanguageModelV3({ doGenerate: async () => summary(), doStream: async () => answer() })
  await expect(client(model, conversations).chat('chat').user('Continue').run()).rejects.toMatchObject({ code: 'copilot_summary_input_limit' })
  expect(model.doGenerateCalls).toHaveLength(0)
  expect(model.doStreamCalls).toHaveLength(0)
  expect((await conversations.snapshot('chat'))?.messages.slice(0, seeded.messages.length)).toEqual(seeded.messages)
})

test('recent completed turn survives even when fixed instructions already exceed the compaction target', async () => {
  const conversations = new InMemoryConversationStore()
  await seed(conversations, 24, 100)
  const model = new MockLanguageModelV3({ doGenerate: async () => summary(), doStream: async () => answer() })
  const factory = new AiSdkCopilotClientFactory({ model, conversations, tools: new ToolRegistry(), maxContextTokens: 16_000 })
  await factory.create('Fresh policy. ' + 'p'.repeat(6500)).chat('chat').user('Continue').run()
  expect(model.doGenerateCalls.length).toBeGreaterThan(0)
  expect(JSON.stringify(model.doStreamCalls[0].prompt)).toContain('Old request 23:')
  expect(JSON.stringify(model.doStreamCalls[0].prompt)).toContain('Old answer 23.')
  expect(JSON.stringify(model.doStreamCalls[0].prompt)).not.toContain('Old request 0:')
})

test('a protected recent turn that cannot fit fails explicitly instead of silently summarizing it away', async () => {
  const conversations = new InMemoryConversationStore()
  await seed(conversations, 1, 20_000)
  const model = new MockLanguageModelV3({ doGenerate: async () => summary(), doStream: async () => answer() })
  await expect(client(model, conversations).chat('chat').user('Continue').run()).rejects.toMatchObject({ code: 'copilot_context_limit' })
  expect(model.doGenerateCalls).toHaveLength(0)
  expect(model.doStreamCalls).toHaveLength(0)
})

test('large archive selection bounds expensive rendering by source size rather than candidate boundary count', async () => {
  const history = Array.from({ length: 1500 }, (_, index) => [
    message(`large-user-${index}`, 'user', 'Historical record '.repeat(8)),
    message(`large-answer-${index}`, 'assistant', 'Recorded answer')
  ]).flat()
  history.push({ ...message('current', 'user', 'Continue'), runId: 'current-run' })
  const model = new MockLanguageModelV3({ doGenerate: async () => summary() })
  const render = vi.fn((message: ConversationMessage) => [{ role: 'user' as const,
    content: message.content.flatMap(part => part.type === 'text' ? [part.text] : []).join('\n') }])
  let summaries = 0
  const result = await new CopilotHistoryContext(model, 16_000).prepare({ history, runId: 'current-run',
    instructions: '', definitions: [], signal: new AbortController().signal, render,
    save: async (text, lastSourceMessageId) => message(`checkpoint-${++summaries}`, 'developer', text, {
      historySummary: { lastSourceMessageId, sourceMessagesRetained: true }
    }) })
  expect(summaries).toBeGreaterThan(1)
  expect(result.messages.at(-1)?.content).toBe('Continue')
  expect(render.mock.calls.length).toBeLessThanOrEqual(history.length + summaries)
  for (const call of model.doGenerateCalls) expect(Buffer.byteLength(JSON.stringify(call.prompt)) + 4096).toBeLessThan(16_000)
})

test('an oversized current tool result remains completed and is never trimmed or replayed', async () => {
  const conversations = new InMemoryConversationStore()
  const effect = vi.fn(() => ({ structuredContent: { report: 'x'.repeat(20_000) } }))
  const tools = new ToolRegistry([{ definition: { name: 'effect', description: 'Synthetic', inputSchema: { type: 'object' } }, execute: effect }])
  const model = new MockLanguageModelV3({ doGenerate: async () => summary(), doStream: async () => ({
    stream: new ReadableStream({ start (controller) {
      controller.enqueue({ type: 'tool-call', toolCallId: 'effect', toolName: 'phoenix_effect', input: '{}' })
      controller.enqueue({ type: 'finish', finishReason: { unified: 'tool-calls', raw: 'tool_calls' }, usage })
      controller.close()
    } })
  }) })
  await expect(client(model, conversations, tools).chat('chat').user('Read the report').run()).rejects.toMatchObject({ code: 'copilot_context_limit' })
  expect(effect).toHaveBeenCalledTimes(1)
  expect(model.doGenerateCalls).toHaveLength(0)
  expect(model.doStreamCalls).toHaveLength(1)
  expect((await conversations.snapshot('chat'))?.messages.at(-1)?.content[0]).toMatchObject({ status: 'success', structuredContent: { report: 'x'.repeat(20_000) } })
})
