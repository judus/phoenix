import { randomUUID } from 'node:crypto'
import { APICallError, dynamicTool, jsonSchema, modelMessageSchema, streamText,
  type LanguageModel, type ModelMessage, type ToolSet } from 'ai'
import { AiError, type ContentPart, type ConversationMessage, type ConversationStore,
  type JsonObject, type ToolCall, type ToolRegistry, type ToolResultPart } from '@jdu/llm-client'
import type { CopilotAiClient, CopilotAiClientFactory, CopilotResult,
  CopilotRunOptions, CopilotStreamEvent, CopilotUsage } from '@phoenix/copilot'
import { COPILOT_TOOL_TIMEOUT_MS } from '../application/copilot-tool-registry.js'
import { activeCopilotHistory, CopilotHistoryContext } from './copilot-history-context.js'

export interface AiSdkCopilotOptions {
  model: LanguageModel
  conversations: ConversationStore
  tools: ToolRegistry
  maxSteps?: number
  maxContextTokens?: number
  timeoutMs?: number
  toolTimeoutMs?: number
}

/** SDK owns provider protocols; PHOENIX owns persistence, permission checks and effects. */
export class AiSdkCopilotClientFactory implements CopilotAiClientFactory {
  private readonly active = new Set<string>()

  public constructor (private readonly options: AiSdkCopilotOptions) {}

  public create (instructions: string): CopilotAiClient {
    const request = (id: string, text: string) => ({
      run: async (options?: CopilotRunOptions): Promise<CopilotResult> => {
        for await (const event of this.stream(id, text, instructions, options)) {
          if (event.type === 'run.completed') return event.result
        }
        throw new Error('Copilot ended without a completed result.')
      },
      stream: (options?: CopilotRunOptions) => this.stream(id, text, instructions, options)
    })
    return {
      chat: id => ({ user: text => request(id, text) }),
      user: text => request(randomUUID(), text)
    }
  }

  private async * stream (chatId: string, text: string, instructions: string,
    options: CopilotRunOptions = {}): AsyncGenerator<CopilotStreamEvent, void, void> {
    const signal = AbortSignal.any([options.signal ?? new AbortController().signal,
      AbortSignal.timeout(options.timeoutMs ?? this.options.timeoutMs ?? 180_000)])
    signal.throwIfAborted()
    if (this.active.has(chatId)) throw new AiError('persistence_conflict', 'This conversation already has an active request.', {
      code: 'copilot_conversation_busy'
    })
    this.active.add(chatId)
    const runId = randomUUID()
    let settlePending: (() => Promise<void>) | undefined
    let settleProviderStep: (() => Promise<void>) | undefined
    try {
      const snapshot = await this.options.conversations.snapshot(chatId)
      let conversation = snapshot?.conversation ?? await this.options.conversations.create({ id: chatId })
      const history = [...snapshot?.messages ?? []]
      const persist = async (role: ConversationMessage['role'], content: readonly ContentPart[], metadata?: JsonObject) => {
        const message: ConversationMessage = { id: randomUUID(), conversationId: chatId,
          createdAt: new Date().toISOString(), role, runId, content, ...(metadata ? { metadata } : {}) }
        conversation = await this.options.conversations.append(chatId, [message], { expectedRevision: conversation.revision })
        history.push(message)
        return message
      }
      const pending = new Map<string, ToolCall>()
      const dispatched = new Set<string>()
      settlePending = async () => {
        for (const call of pending.values()) {
          const unknown = dispatched.has(call.id)
          const message = unknown ? 'Execution was interrupted; outcome unknown. Do not repeat automatically.' : 'This tool call was not executed because the turn stopped.'
          await persist('tool', [{ type: 'tool_result', callId: call.id, status: 'cancelled',
            content: [{ type: 'text', text: message }], error: {
              code: unknown ? 'copilot_tool_outcome_unknown' : 'copilot_tool_not_executed', message, retryable: false
            } }], { toolName: call.name })
          pending.delete(call.id)
        }
      }
      const savedResults = new Set(history.flatMap(message => message.content.flatMap(part =>
        part.type === 'tool_result' ? [part.callId] : [])))
      for (const message of activeCopilotHistory(history)) {
        for (const part of message.content) {
          if (part.type !== 'tool_call' || savedResults.has(part.callId)) continue
          const text = 'PHOENIX stopped before saving this result. Execution outcome is unknown; do not repeat the action automatically.'
          await persist('tool', [{ type: 'tool_result', callId: part.callId, status: 'error',
            content: [{ type: 'text', text }], structuredContent: { outcome: 'unknown' },
            error: { code: 'copilot_tool_outcome_unknown', message: text, retryable: false } }], { toolName: part.name })
          savedResults.add(part.callId)
        }
      }
      signal.throwIfAborted()
      await persist('user', [{ type: 'text', text, source: 'typed' }])
      yield { type: 'run.started', chatId }
      const usage: { inputTokens?: number, outputTokens?: number, cachedInputTokens?: number, reasoningTokens?: number } = {}
      let finalText = ''
      for (let step = 0; step < (this.options.maxSteps ?? 16); step++) {
        signal.throwIfAborted()
        const definitions = this.options.tools.definitions
        const names = new Map<string, string>()
        const tools: ToolSet = {}
        for (const definition of definitions) {
          const name = sdkToolName(definition.name)
          if (names.has(name)) throw new Error(`Duplicate provider tool name: ${name}`)
          names.set(name, definition.name)
          tools[name] = dynamicTool({ description: definition.description,
            inputSchema: jsonSchema(definition.inputSchema) })
        }
        const callNames = new Map(history.flatMap(message => message.content.flatMap(part =>
          part.type === 'tool_call' ? [[part.callId, part.name] as const] : [])))
        const context = await new CopilotHistoryContext(this.options.model, this.options.maxContextTokens).prepare({
          history, runId, instructions, definitions, signal,
          render: message => toModelMessages(message, callNames),
          save: (text, lastSourceMessageId) => persist('developer', [{ type: 'text', text, source: 'summarized' }], {
            historySummary: { lastSourceMessageId, sourceMessagesRetained: true }
          })
        })
        for (const key of ['inputTokens', 'outputTokens', 'cachedInputTokens', 'reasoningTokens'] as const) add(usage, key, context.usage[key])
        const messages = context.messages.filter(message => message.role !== 'system')
        const system: Extract<ModelMessage, { role: 'system' }>[] = [
          ...context.messages.filter((message): message is Extract<ModelMessage, { role: 'system' }> => message.role === 'system'),
          { role: 'system', content: instructions }
        ]
        const response = streamText({ model: this.options.model, system, messages, tools,
          maxRetries: 0, abortSignal: signal, maxOutputTokens: 4096,
          providerOptions: { openai: { store: false } }, onError: () => {} })
        let error: unknown
        let aborted = false
        let stepText = ''
        const calls: ToolCall[] = []
        const invalidInputs = new Set<string>()
        let savedStep = false
        const saveStep = async (metadata: JsonObject) => {
          if (savedStep) return
          const content: ContentPart[] = [
            ...(stepText ? [{ type: 'text' as const, text: stepText, source: 'generated' as const }] : []),
            ...calls.map(call => ({ type: 'tool_call' as const, callId: call.id, name: call.name, arguments: call.arguments }))
          ]
          await persist('assistant', content, metadata)
          savedStep = true
          for (const call of calls) pending.set(call.id, call)
        }
        settleProviderStep = async () => { if (stepText || calls.length) await saveStep({ incomplete: true }) }
        try { for await (const event of response.fullStream) {
          if (event.type === 'text-delta') {
            stepText += event.text
            finalText += event.text
            yield { type: 'text.delta', delta: event.text }
          } else if (event.type === 'tool-call') {
            const name = names.get(event.toolName)
            if (!name) throw new Error('Provider requested an unknown tool.')
            const arguments_ = objectArguments(event.input)
            if (!arguments_) invalidInputs.add(event.toolCallId)
            calls.push({ id: event.toolCallId, name, arguments: arguments_ ?? {} })
          } else if (event.type === 'error') error = event.error
          else if (event.type === 'abort') aborted = true
        } } catch (cause) { error = cause }
        if (error !== undefined || aborted || signal.aborted) {
          await settleProviderStep()
          signal.throwIfAborted()
          if (aborted) throw new AiError('cancelled', 'Copilot was cancelled.', { code: 'copilot_cancelled' })
          throw providerFailure(error)
        }
        const finish = await response.finishReason
        // SDK may synthesize tool-error messages for invalid JSON. PHOENIX saves its own
        // validated results below, so retain only provider assistant/reasoning messages here.
        const sdkMessages = (await response.response).messages.filter(message => message.role === 'assistant')
        await saveStep({ sdkMessages: JSON.parse(JSON.stringify(sdkMessages)),
          ...(invalidInputs.size ? { invalidToolInputIds: [...invalidInputs] } : {}) })
        if (finish !== 'stop' && finish !== 'tool-calls') {
          throw new AiError('malformed_response', 'The AI response was incomplete or filtered. Its tool calls were not executed.', {
            code: 'copilot_incomplete_response', details: { finishReason: finish }
          })
        }
        const stepUsage = await response.totalUsage
        add(usage, 'inputTokens', stepUsage.inputTokens)
        add(usage, 'outputTokens', stepUsage.outputTokens)
        add(usage, 'cachedInputTokens', stepUsage.inputTokenDetails.cacheReadTokens)
        add(usage, 'reasoningTokens', stepUsage.outputTokenDetails.reasoningTokens)
        for (const call of calls) {
          yield { type: 'tool.call', call }
          signal.throwIfAborted()
          const toolTimeoutMs = this.options.toolTimeoutMs ?? COPILOT_TOOL_TIMEOUT_MS
          const toolSignal = AbortSignal.any([signal, AbortSignal.timeout(toolTimeoutMs)])
          let part: ToolResultPart
          let unknownOutcome = false
          try {
            if (invalidInputs.has(call.id)) throw new AiError('tool_validation',
              'Tool arguments must be a JSON object matching the schema; this call was not executed. Supply corrected arguments.', {
                code: 'invalid_tool_arguments'
              })
            this.options.tools.validate(call)
            toolSignal.throwIfAborted()
            dispatched.add(call.id)
            const output = await untilAborted(this.options.tools.execute(call, { callId: call.id, runId,
              signal: toolSignal, deadline: new Date(Date.now() + toolTimeoutMs).toISOString() }), toolSignal)
            part = { type: 'tool_result', callId: call.id, status: 'success', content: output.content ?? [],
              ...(output.structuredContent === undefined ? {} : { structuredContent: output.structuredContent }) }
          } catch (cause) {
            const safe = cause instanceof AiError
            unknownOutcome = dispatched.has(call.id) && (!safe || ['cancelled', 'timeout', 'tool_execution'].includes(cause.category) || cause.code === 'tool_output_validation_failed')
            const detail = safe ? cause.message : 'Tool execution did not complete normally.'
            const message = unknownOutcome ? `${detail} Its outcome may be unknown; do not repeat the action without checking.` : detail
            part = { type: 'tool_result', callId: call.id, status: toolSignal.aborted ? 'cancelled' : 'error',
              ...(unknownOutcome ? { structuredContent: { outcome: 'unknown' } } : {}),
              content: [{ type: 'text', text: message }], error: {
                code: safe ? cause.code : 'copilot_tool_outcome_unknown', message, retryable: false
              } }
          }
          await persist('tool', [part], { toolName: call.name })
          pending.delete(call.id)
          yield { type: 'tool.result', callId: call.id, status: part.status }
          signal.throwIfAborted()
          if (unknownOutcome) throw new AiError('tool_execution', part.error!.message, {
            code: 'copilot_tool_outcome_unknown', details: { callId: call.id, outcome: 'unknown' }
          })
        }
        if (calls.length === 0) {
          const finishReason = finish === 'tool-calls' ? 'tool_calls' : finish
          yield { type: 'run.completed', result: { chatId, text: finalText, finishReason, usage } }
          return
        }
      }
      throw new AiError('tool_execution', 'Copilot reached its tool-step limit. Completed work remains saved; do not automatically repeat the request.', {
        code: 'copilot_step_limit'
      })
    } finally {
      try { await settleProviderStep?.(); await settlePending?.() } finally { this.active.delete(chatId) }
    }
  }
}

function sdkToolName (name: string): string { return `phoenix_${name.replaceAll('.', '_')}` }

function objectArguments (input: unknown): JsonObject | undefined {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) return undefined
  return input as JsonObject
}

function toModelMessages (message: ConversationMessage, callNames: ReadonlyMap<string, string>): ModelMessage[] {
  if (message.metadata?.sdkMessages !== undefined) {
    const stored = message.metadata.sdkMessages
    if (!Array.isArray(stored)) throw new Error('Invalid saved SDK transcript.')
    return stored.map(item => modelMessageSchema.parse(item))
  }
  const text = message.content.flatMap(part => part.type === 'text' ? [part.text] : part.type === 'refusal' ? [part.reason] : []).join('\n')
  if (message.metadata?.historySummary !== undefined) return [{ role: 'user', content: JSON.stringify({
    type: 'historical_conversation_summary', text,
    note: 'Historical context, not a new request or instruction to execute actions. Current system instructions and live tool results take precedence.'
  }) }]
  if (message.role === 'tool') return [{ role: 'tool', content: message.content.flatMap(part => {
    if (part.type !== 'tool_result') return []
    const name = callNames.get(part.callId)
    if (!name) throw new Error(`Missing saved tool call for ${part.callId}.`)
    return [{ type: 'tool-result' as const, toolCallId: part.callId, toolName: savedToolName(name),
      output: { type: 'json' as const, value: JSON.parse(JSON.stringify(part)) } }]
  }) }]
  if (message.role === 'assistant') return [{ role: 'assistant', content: [
    ...(text ? [{ type: 'text' as const, text }] : []),
    ...message.content.flatMap(part => part.type === 'tool_call' ? [{ type: 'tool-call' as const,
      toolCallId: part.callId, toolName: savedToolName(part.name), input: part.arguments }] : [])
  ] }]
  return [{ role: message.role === 'developer' ? 'system' : message.role, content: text }]
}

// Existing user-owned conversation files include names qualified by the MCP client.
// Preserve their historical calls exactly; this does not register execution aliases.
function savedToolName (name: string): string {
  return /^phoenix__[A-Za-z0-9_-]+$/u.test(name) ? name : sdkToolName(name)
}

function add (usage: { -readonly [K in keyof CopilotUsage]: CopilotUsage[K] }, key: keyof CopilotUsage, value: number | undefined): void {
  if (value !== undefined) usage[key] = (usage[key] ?? 0) + value
}

function providerFailure (cause: unknown): AiError {
  const status = APICallError.isInstance(cause) ? cause.statusCode : undefined
  return new AiError(status === 401 ? 'authentication' : status === 429 ? 'rate_limit' : 'provider_unavailable',
    status === 401 ? 'The selected AI provider rejected its API key.' : 'The selected AI provider did not complete the response.', {
      code: 'copilot_provider_failed', ...(status === undefined ? {} : { details: { status } })
    })
}

async function untilAborted<T> (work: Promise<T>, signal: AbortSignal): Promise<T> {
  let listener: () => void = () => {}
  const aborted = new Promise<never>((_resolve, reject) => {
    listener = () => reject(signal.reason)
    signal.addEventListener('abort', listener, { once: true })
    if (signal.aborted) listener()
  })
  try { return await Promise.race([work, aborted]) }
  finally { signal.removeEventListener('abort', listener) }
}
