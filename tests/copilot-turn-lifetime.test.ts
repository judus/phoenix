import { request as httpRequest } from 'node:http'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test, vi } from 'vitest'
import { MockLanguageModelV3 } from 'ai/test'
import type { LanguageModelV3StreamPart } from '@ai-sdk/provider'
import { ToolRegistry } from '@jdu/llm-client'
import { createEmptyRuntimeState, type CopilotConversationEvent } from '@phoenix/contracts'
import { AgentPromptComposer, RuntimeContextRenderer, TextCopilotPipeline, type CopilotRunOptions } from '@phoenix/copilot'
import { AiSdkCopilotClientFactory } from '../apps/server/src/infrastructure/ai-sdk-copilot-client.js'
import { JsonConversationStore } from '../apps/server/src/infrastructure/json-conversation-store.js'
import { CopilotTextService, type CopilotText } from '../apps/server/src/application/copilot-text-service.js'
import { PhoenixApplication } from '../apps/server/src/phoenix-application.js'
import { readSseEvents } from './support/sse-events.js'

const usage = { inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 1, text: 1, reasoning: 0 } }
const call: LanguageModelV3StreamPart[] = [
  { type: 'tool-call', toolCallId: 'effect', toolName: 'phoenix_test_effect', input: '{}' },
  { type: 'finish', finishReason: { unified: 'tool-calls', raw: 'tool_calls' }, usage }
]
const answer: LanguageModelV3StreamPart[] = [
  { type: 'text-start', id: 'answer' }, { type: 'text-delta', id: 'answer', delta: 'Done.' }, { type: 'text-end', id: 'answer' },
  { type: 'finish', finishReason: { unified: 'stop', raw: 'stop' }, usage }
]

test.each([
  { mode: 'json', phase: 'before-dispatch' }, { mode: 'sse', phase: 'before-dispatch' },
  { mode: 'json', phase: 'after-effect-start' }, { mode: 'sse', phase: 'after-effect-start' },
  { mode: 'json', phase: 'after-effect-complete' }, { mode: 'sse', phase: 'after-effect-complete' },
  { mode: 'json', phase: 'normal' }, { mode: 'sse', phase: 'normal' },
  { mode: 'json', phase: 'shutdown' }, { mode: 'sse', phase: 'shutdown' }
] as const)('$mode turn lifetime at $phase with actual SDK history', async ({ mode, phase }) => {
  const directory = await mkdtemp(join(tmpdir(), 'phoenix-turn-lifetime-'))
  const conversations = new JsonConversationStore(directory)
  const providerEntered = Promise.withResolvers<void>()
  const finalProviderEntered = Promise.withResolvers<void>()
  const effectEntered = Promise.withResolvers<void>()
  const effectFinish = Promise.withResolvers<void>()
  const turnFinished = Promise.withResolvers<void>()
  const providerAborted = Promise.withResolvers<void>()
  const responseComplete = Promise.withResolvers<{ status: number | undefined, body: string }>()
  let effects = 0
  let steps = 0
  let forwardSignal: AbortSignal | undefined
  let emitTool = () => {}
  let stopProviderObserver = () => {}
  const model = new MockLanguageModelV3({ doStream: async options => {
    const first = steps++ === 0
    return { stream: new ReadableStream<LanguageModelV3StreamPart>({ start (controller) {
      if (!first && phase !== 'after-effect-complete') { for (const event of answer) controller.enqueue(event); controller.close(); return }
      let closed = false
      const abort = () => {
        providerAborted.resolve()
        if (!closed) { closed = true; controller.error(options.abortSignal?.reason) }
      }
      options.abortSignal?.addEventListener('abort', abort, { once: true })
      stopProviderObserver = () => options.abortSignal?.removeEventListener('abort', abort)
      emitTool = () => {
        if (closed) return
        for (const event of first ? call : answer) controller.enqueue(event)
        closed = true
        controller.close()
      }
      if (first && phase !== 'before-dispatch' && phase !== 'shutdown') emitTool()
      if (first) providerEntered.resolve()
      else finalProviderEntered.resolve()
    } }) }
  } })
  const tools = new ToolRegistry([{ definition: { name: 'test.effect', description: 'Synthetic recording effect', inputSchema: { type: 'object', properties: {}, additionalProperties: false } },
    execute: async () => { effects++; effectEntered.resolve(); if (phase === 'after-effect-start') await effectFinish.promise; return { structuredContent: { completed: true } } } }])
  const factory = new AiSdkCopilotClientFactory({ model, tools, conversations })
  const pipeline = new TextCopilotPipeline(factory, new AgentPromptComposer({ get: () => ({ agent: '{{ OPERATIONAL }}', operational: 'Use synthetic tools.', prologue: '', characterSpeech: '', characterText: '' }) }), new RuntimeContextRenderer())
  const service = new CopilotTextService(pipeline, { getCurrent: () => createEmptyRuntimeState() }, conversations)
  const observed: CopilotText = {
    getHistory: id => service.getHistory(id),
    run: async (input, options) => { forwardSignal = options?.signal; try { return await service.run(input, options) } finally { turnFinished.resolve() } },
    stream: async function * (input, options?: CopilotRunOptions) { forwardSignal = options?.signal; try { yield * service.stream(input, options) } finally { turnFinished.resolve() } }
  }
  const application = new PhoenixApplication({ copilot: observed, copilotRealtime: null, openAiEnvironmentKey: null,
    databasePath: ':memory:', eliteDirectory: null, host: '127.0.0.1', port: 0 })
  const subscriptionAbort = new AbortController()
  const events: CopilotConversationEvent[] = []
  let stopSubscription: Promise<void> | undefined
  let client: ReturnType<typeof httpRequest> | undefined
  let shutdown: Promise<void> | undefined
  try {
    const address = await application.start()
    const origin = `http://${address.host}:${address.port}`
    const subscription = await fetch(`${origin}/api/copilot/conversations/characterization/stream`, { signal: subscriptionAbort.signal })
    stopSubscription = (async () => {
      try {
        for await (const event of readSseEvents(subscription)) {
          if (event.event !== 'conversation-event') continue
          const received: CopilotConversationEvent = JSON.parse(event.data)
          events.push(received)
          if (['turn.completed', 'turn.cancelled', 'turn.failed'].includes(received.type)) break
        }
      }
      catch (cause) { if (!subscriptionAbort.signal.aborted) throw cause }
    })()
    client = httpRequest(`${origin}/api/copilot/chat`, { method: 'POST', headers: {
      'content-type': 'application/json', accept: mode === 'sse' ? 'text/event-stream' : 'application/json'
    } }, response => {
      let body = ''
      response.setEncoding('utf8')
      response.on('data', chunk => { body += chunk })
      response.once('end', () => responseComplete.resolve({ status: response.statusCode, body }))
    })
    const clientErrors: string[] = []
    client.on('error', cause => clientErrors.push(cause.message))
    client.end(JSON.stringify({ message: 'Run synthetic effect', conversationId: 'characterization', turnId: 'turn', clientId: 'client' }))
    if (phase === 'normal') {
      const response = await responseComplete.promise
      expect(response.status).toBe(200)
      if (mode === 'json') expect(JSON.parse(response.body)).toMatchObject({ conversationId: 'characterization', text: 'Done.', finishReason: 'stop' })
      else expect(response.body).toContain('Done.')
    } else {
      await (phase === 'before-dispatch' || phase === 'shutdown' ? providerEntered.promise : phase === 'after-effect-start' ? effectEntered.promise : finalProviderEntered.promise)
      if (phase === 'shutdown') shutdown = application.stop()
      else client.destroy()
      await providerAborted.promise
    }
    const abortedAtDisconnect = forwardSignal?.aborted ?? false
    emitTool()
    effectFinish.resolve()
    await turnFinished.promise
    await vi.waitFor(() => expect(events.filter(event => ['turn.completed', 'turn.cancelled', 'turn.failed'].includes(event.type))).toHaveLength(1))
    const saved = await new JsonConversationStore(directory).snapshot('characterization')
    const result = saved?.messages.flatMap(message => message.content).find(part => part.type === 'tool_result')
    const expectedCancellation = phase !== 'normal'
    expect(abortedAtDisconnect).toBe(expectedCancellation)
    expect(effects).toBe(phase === 'before-dispatch' || phase === 'shutdown' ? 0 : 1)
    if (phase === 'after-effect-start' && expectedCancellation) expect(result).toMatchObject({ status: 'cancelled', structuredContent: { outcome: 'unknown' } })
    else if (!expectedCancellation || phase === 'after-effect-complete') expect(result).toMatchObject({ status: 'success' })
    expect(events.filter(event => event.type === 'turn.started')).toHaveLength(1)
    expect(events.at(-1)?.type).toBe(expectedCancellation ? 'turn.cancelled' : 'turn.completed')
    expect(model.doStreamCalls).toHaveLength(phase === 'normal' || phase === 'after-effect-complete' ? 2 : 1)
  } finally {
    client?.destroy()
    emitTool()
    effectFinish.resolve()
    stopProviderObserver()
    subscriptionAbort.abort()
    await stopSubscription
    await (shutdown ?? application.stop())
    await rm(directory, { recursive: true, force: true })
  }
}, 15_000)
