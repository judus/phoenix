import { afterEach, expect, test } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { MockLanguageModelV3 } from 'ai/test'
import type { LanguageModelV3StreamPart } from '@ai-sdk/provider'
import { AiError, InMemoryConversationStore, ToolRegistry } from '@jdu/llm-client'
import { AiSdkCopilotClientFactory } from '../apps/server/src/infrastructure/ai-sdk-copilot-client.js'
import { CopilotToolRegistry } from '../apps/server/src/application/copilot-tool-registry.js'
import { JsonConversationStore } from '../apps/server/src/infrastructure/json-conversation-store.js'

const directories: string[] = []
afterEach(async () => { for (const directory of directories.splice(0)) await rm(directory, { recursive: true, force: true }) })

const usage = { inputTokens: { total: 2, noCache: 2, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 3, text: 3, reasoning: 0 } }
function modelFor (steps: LanguageModelV3StreamPart[][], before?: () => void) {
  let index = 0
  return new MockLanguageModelV3({ doStream: async () => {
    before?.()
    const parts = steps[index++]
    if (!parts) throw new Error('Unexpected provider request')
    return { stream: new ReadableStream<LanguageModelV3StreamPart>({ start (controller) {
      for (const part of parts) controller.enqueue(part)
      controller.close()
    } }) }
  } })
}
const done = (): LanguageModelV3StreamPart[] => [
  { type: 'text-start', id: 'text' }, { type: 'text-delta', id: 'text', delta: 'All clear 🚀' },
  { type: 'text-end', id: 'text' }, { type: 'finish', finishReason: { unified: 'stop', raw: 'stop' }, usage }
]
const call = (input = '{}'): LanguageModelV3StreamPart[] => [
  { type: 'tool-call', toolCallId: 'call', toolName: 'phoenix_ship_status', input },
  { type: 'finish', finishReason: { unified: 'tool-calls', raw: 'tool_calls' }, usage }
]
const definition = { name: 'ship.status', description: 'Current ship',
  inputSchema: { type: 'object', properties: {}, additionalProperties: false } }

test('SDK executes local tool, sends full catalogue and retains all steps across a new client instance', async () => {
  let effects = 0
  const conversations = new InMemoryConversationStore()
  const tools = new ToolRegistry([{ definition, execute: () => { effects++; return { structuredContent: { fuel: 7 } } } }])
  const model = modelFor([call(), done(), done()])
  const factory = new AiSdkCopilotClientFactory({ model, conversations, tools })
  const result = await factory.create('Stay in character.').chat('saved').user('Ship status?').run()
  expect(result.text).toBe('All clear 🚀')
  expect(result.usage.inputTokens).toBe(4)
  expect(effects).toBe(1)
  expect(model.doStreamCalls.map(c => c.tools?.length)).toEqual([1, 1])
  const snapshot = await conversations.snapshot('saved')
  expect(snapshot?.messages.map(m => m.role)).toEqual(['user', 'assistant', 'tool', 'assistant'])
  await new AiSdkCopilotClientFactory({ model, conversations, tools }).create('Stay in character.')
    .chat('saved').user('And now?').run()
  expect(model.doStreamCalls[2].prompt.some(m => m.role === 'tool')).toBe(true)
  expect(effects).toBe(1)
})

test('pre-abort and initial context overflow never enter provider or tool', async () => {
  const conversations = new InMemoryConversationStore()
  const model = modelFor([done()])
  const factory = new AiSdkCopilotClientFactory({ model, conversations, tools: new ToolRegistry(), maxContextTokens: 100 })
  await expect(factory.create('Required instructions').user('Hello').run({ signal: AbortSignal.abort() })).rejects.toThrow()
  await expect(factory.create('Required instructions').user('Hello').run()).rejects.toMatchObject({ code: 'copilot_context_limit' })
  expect(model.doStreamCalls).toHaveLength(0)
})

test('revocation after catalogue capture rejects before local effect', async () => {
  let enabled = true
  let effects = 0
  const tools = new CopilotToolRegistry([{ definition, execute: () => { effects++; return {} } }], {
    isToolEnabled: () => enabled
  })
  const model = modelFor([call(), done()], () => { enabled = false })
  const conversations = new InMemoryConversationStore()
  await new AiSdkCopilotClientFactory({ model, conversations, tools }).create('').chat('revoke').user('Status').run()
  expect(effects).toBe(0)
  const result = (await conversations.snapshot('revoke'))?.messages.find(m => m.role === 'tool')?.content[0]
  expect(result).toMatchObject({ status: 'error', error: { code: 'copilot_tool_disabled' } })
})

test('provider stream error followed by finish does not report completion or execute tools', async () => {
  const model = modelFor([[{ type: 'error', error: new Error('Broken stream') }, ...done()]])
  const conversations = new InMemoryConversationStore()
  const client = new AiSdkCopilotClientFactory({ model, conversations, tools: new ToolRegistry() }).create('')
  await expect(client.chat('broken').user('Hello').run()).rejects.toMatchObject({ code: 'copilot_provider_failed' })
  expect((await conversations.snapshot('broken'))?.messages.at(-1)?.metadata).toMatchObject({ incomplete: true })
})

test('effect followed by cancellation is saved as unknown and never automatically retried', async () => {
  const controller = new AbortController()
  let effects = 0
  const conversations = new InMemoryConversationStore()
  const tools = new ToolRegistry([{ definition, execute: () => { effects++; controller.abort(); return {} } }])
  const model = modelFor([call()])
  const client = new AiSdkCopilotClientFactory({ model, conversations, tools }).create('')
  await expect(client.chat('cancel').user('Status').run({ signal: controller.signal })).rejects.toThrow()
  expect(effects).toBe(1)
  expect(model.doStreamCalls).toHaveLength(1)
  const result = (await conversations.snapshot('cancel'))?.messages.at(-1)?.content[0]
  expect(result).toMatchObject({ status: 'cancelled', structuredContent: { outcome: 'unknown' }, error: { retryable: false } })
})

test.each(['abort', 'return'] as const)('consumer %s at tool.call closes all pending calls and disk history reopens', async mode => {
  const directory = await mkdtemp(join(tmpdir(), 'phoenix-sdk-test-'))
  directories.push(directory)
  const conversations = new JsonConversationStore(directory)
  let effects = 0
  const tools = new ToolRegistry([{ definition, execute: () => { effects++; return {} } }])
  const twoCalls = call()
  twoCalls.splice(1, 0, { type: 'tool-call', toolCallId: 'second', toolName: 'phoenix_ship_status', input: '{}' })
  const model = modelFor([twoCalls, done()])
  const controller = new AbortController()
  const iterator = new AiSdkCopilotClientFactory({ model, conversations, tools }).create('').chat('disk')
    .user('Status').stream({ signal: controller.signal })
  expect((await iterator.next()).value).toMatchObject({ type: 'run.started' })
  expect((await iterator.next()).value).toMatchObject({ type: 'tool.call' })
  if (mode === 'abort') {
    controller.abort()
    await expect(iterator.next()).rejects.toThrow()
  } else await iterator.return()
  expect(effects).toBe(0)
  const reopened = new JsonConversationStore(directory)
  const saved = await reopened.snapshot('disk')
  expect(saved?.messages.filter(m => m.role === 'tool').map(m => m.content[0])).toMatchObject([
    { callId: 'call', error: { code: 'copilot_tool_not_executed' } },
    { callId: 'second', error: { code: 'copilot_tool_not_executed' } }
  ])
  await new AiSdkCopilotClientFactory({ model, conversations: reopened, tools }).create('').chat('disk').user('Hello').run()
  expect(model.doStreamCalls[1].prompt.flatMap(m => m.role === 'tool' ? m.content : [])).toHaveLength(2)
})

test('malformed object arguments cause zero effects and retain a correction result', async () => {
  let effects = 0
  const conversations = new InMemoryConversationStore()
  const tools = new ToolRegistry([{ definition, execute: () => { effects++; return {} } }])
  const model = modelFor([call('{"unexpected":true}'), done()])
  await new AiSdkCopilotClientFactory({ model, conversations, tools }).create('').chat('bad').user('Status').run()
  expect(effects).toBe(0)
  expect((await conversations.snapshot('bad'))?.messages.find(m => m.role === 'tool')?.content[0]).toMatchObject({
    status: 'error', error: { code: 'tool_input_validation_failed' }
  })
})

test('existing user-owned MCP conversation calls/results keep their original names', async () => {
  const conversations = new InMemoryConversationStore()
  await conversations.create({ id: 'old' })
  await conversations.append('old', [
    { id: 'old-call', conversationId: 'old', createdAt: new Date().toISOString(), role: 'assistant',
      content: [{ type: 'tool_call', callId: 'old-id', name: 'phoenix__ship_status', arguments: {} }] },
    { id: 'old-result', conversationId: 'old', createdAt: new Date().toISOString(), role: 'tool',
      content: [{ type: 'tool_result', callId: 'old-id', status: 'success', content: [{ type: 'text', text: 'Saved result' }] }] }
  ], { expectedRevision: 0 })
  const model = modelFor([done()])
  await new AiSdkCopilotClientFactory({ model, conversations, tools: new ToolRegistry() }).create('')
    .chat('old').user('Continue').run()
  const toolMessages = model.doStreamCalls[0].prompt.flatMap(m => m.role === 'tool' ? m.content : [])
  expect(toolMessages[0]).toMatchObject({ toolName: 'phoenix__ship_status', toolCallId: 'old-id' })
})

test.each(['length', 'content-filter'] as const)('finish %s does not dispatch collected calls', async reason => {
  let effects = 0
  const parts = call()
  parts[parts.length - 1] = { type: 'finish', finishReason: { unified: reason, raw: reason }, usage }
  const conversations = new InMemoryConversationStore()
  const model = modelFor([parts])
  const tools = new ToolRegistry([{ definition, execute: () => { effects++; return {} } }])
  await expect(new AiSdkCopilotClientFactory({ model, conversations, tools }).create('').chat('truncated').user('Status').run())
    .rejects.toMatchObject({ code: 'copilot_incomplete_response' })
  expect(effects).toBe(0)
  expect(model.doStreamCalls).toHaveLength(1)
  expect((await conversations.snapshot('truncated'))?.messages.at(-1)?.content[0]).toMatchObject({
    error: { code: 'copilot_tool_not_executed' }
  })
})

test.each(['null', '[]', '"string"', '{broken'])('invalid tool input %s is saved with a correction without executing', async input => {
  let effects = 0
  const conversations = new InMemoryConversationStore()
  const model = modelFor([call(input), done()])
  const tools = new ToolRegistry([{ definition, execute: () => { effects++; return {} } }])
  await new AiSdkCopilotClientFactory({ model, conversations, tools }).create('').chat('invalid-input').user('Status').run()
  expect(effects).toBe(0)
  expect((await conversations.snapshot('invalid-input'))?.messages.find(m => m.role === 'tool')?.content[0]).toMatchObject({
    error: { code: 'invalid_tool_arguments' }
  })
  expect(model.doStreamCalls).toHaveLength(2)
  expect(model.doStreamCalls[1].prompt.flatMap(message => message.role === 'tool' ? message.content : [])).toHaveLength(1)
})

test('complete call followed by a stream error is retained as not executed', async () => {
  let effects = 0
  const conversations = new InMemoryConversationStore()
  const model = modelFor([[call()[0], { type: 'error', error: new Error('stream failed') }, ...done()]])
  const tools = new ToolRegistry([{ definition, execute: () => { effects++; return {} } }])
  await expect(new AiSdkCopilotClientFactory({ model, conversations, tools }).create('').chat('interrupted').user('Status').run())
    .rejects.toMatchObject({ code: 'copilot_provider_failed' })
  expect(effects).toBe(0)
  expect((await conversations.snapshot('interrupted'))?.messages.at(-1)?.content[0]).toMatchObject({
    callId: 'call', error: { code: 'copilot_tool_not_executed' }
  })
})

test('reopening after a process stopped reconciles unmatched calls as unknown without replay', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'phoenix-sdk-crash-test-'))
  directories.push(directory)
  const conversations = new JsonConversationStore(directory)
  await conversations.create({ id: 'crash' })
  await conversations.append('crash', [{ id: 'saved-call', conversationId: 'crash', createdAt: new Date().toISOString(), role: 'assistant',
    content: [{ type: 'tool_call', callId: 'unmatched', name: 'ship.status', arguments: {} }] }], { expectedRevision: 0 })
  let effects = 0
  const tools = new ToolRegistry([{ definition, execute: () => { effects++; return {} } }])
  const model = modelFor([done()])
  const reopened = new JsonConversationStore(directory)
  await new AiSdkCopilotClientFactory({ model, conversations: reopened, tools }).create('').chat('crash').user('Continue').run()
  expect(effects).toBe(0)
  const messages = (await reopened.snapshot('crash'))!.messages
  expect(messages.map(m => m.role)).toEqual(['assistant', 'tool', 'user', 'assistant'])
  expect(messages[1].content[0]).toMatchObject({ structuredContent: { outcome: 'unknown' }, error: { retryable: false } })
})

test('known public provider errors retain safe code and correction instead of becoming unknown', async () => {
  const conversations = new InMemoryConversationStore()
  const tools = new ToolRegistry([{ definition, execute: () => {
    throw new AiError('invalid_request', 'Provider rejected the query. Do not repeat unchanged.', {
      code: 'provider_request_rejected', cause: new Error('private-key-must-not-leak')
    })
  } }])
  const model = modelFor([call(), done()])
  await new AiSdkCopilotClientFactory({ model, conversations, tools }).create('').chat('public-error').user('Status').run()
  const saved = await conversations.snapshot('public-error')
  expect(saved?.messages.find(m => m.role === 'tool')?.content[0]).toMatchObject({
    error: { code: 'provider_request_rejected', message: 'Provider rejected the query. Do not repeat unchanged.', retryable: false }
  })
  expect(JSON.stringify(saved)).not.toContain('private-key-must-not-leak')
})
