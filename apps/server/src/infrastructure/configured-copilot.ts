import { appendFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { createAiClient, type AiClient } from '@maduser/ai-ts'
import { openAI, type OpenAIWireEvent, type OpenAIWireLogger } from '@maduser/ai-ts/providers/openai'
import {
  AgentPromptComposer,
  FileAgentProfileRepository,
  RuntimeContextRenderer,
  TextCopilotPipeline,
  type CopilotAiClientFactory
} from '@phoenix/copilot'
import { CopilotTextService, type CopilotText } from '../application/copilot-text-service.js'
import type { RuntimeStateReader } from '../domain/runtime-state.js'
import { JsonConversationStore } from './json-conversation-store.js'

export interface ConfiguredCopilotOptions {
  agentsDirectory?: string
  apiKey?: string
  conversationsDirectory?: string
  maxRetries?: number
  model?: string
  runtimeState: RuntimeStateReader
  timeoutMs?: number
  wireLogEnabled?: boolean
  wireLogFile?: string
}

export function createConfiguredCopilot (
  projectRoot: string,
  options: ConfiguredCopilotOptions
): CopilotText | undefined {
  const apiKey = options.apiKey ?? process.env.PHOENIX_OPENAI_API_KEY ?? process.env.OPENAI_API_KEY
  if (!apiKey) return undefined

  const conversations = new JsonConversationStore(
    resolve(projectRoot, options.conversationsDirectory ?? 'data/conversations')
  )
  const wireLogger = (options.wireLogEnabled ?? environmentBoolean(
    process.env.PHOENIX_OPENAI_WIRE_LOG_ENABLED,
    true
  ))
    ? createWireLogger(resolve(projectRoot, options.wireLogFile ?? 'data/runtime/openai-wire.ndjson'))
    : undefined
  const provider = openAI({
    apiKey,
    maxRetries: options.maxRetries ?? environmentInteger(
      process.env.PHOENIX_OPENAI_MAX_RETRIES,
      1,
      true
    ),
    model: options.model ?? process.env.PHOENIX_OPENAI_MODEL ?? 'gpt-5.6-terra',
    timeoutMs: options.timeoutMs ?? environmentInteger(
      process.env.PHOENIX_OPENAI_TIMEOUT_MS,
      180_000,
      false
    ),
    ...(wireLogger === undefined ? {} : { wireLogger })
  })
  const clients: CopilotAiClientFactory = {
    create: (instructions: string): AiClient => createAiClient({
      history: {
        maxContextTokens: 100_000,
        repository: conversations
      },
      instructions,
      provider
    })
  }
  const pipeline = new TextCopilotPipeline(
    clients,
    new AgentPromptComposer(new FileAgentProfileRepository(
      resolve(projectRoot, options.agentsDirectory ?? 'agents')
    )),
    new RuntimeContextRenderer()
  )
  return new CopilotTextService(pipeline, options.runtimeState, conversations)
}

function createWireLogger (file: string): OpenAIWireLogger {
  mkdirSync(dirname(file), { recursive: true })
  return (event: OpenAIWireEvent): void => {
    appendFileSync(file, `${JSON.stringify(event, wireLogReplacer)}\n`, 'utf8')
  }
}

function wireLogReplacer (key: string, value: unknown): unknown {
  if (['apiKey', 'api_key', 'authorization'].includes(key)) return '[REDACTED]'
  if (typeof value === 'bigint') return value.toString()
  if (value instanceof Error) {
    return {
      cause: value.cause,
      message: value.message,
      name: value.name,
      stack: value.stack
    }
  }
  return value
}

function environmentBoolean (value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback
  if (value === 'true') return true
  if (value === 'false') return false
  throw new Error('PHOENIX_OPENAI_WIRE_LOG_ENABLED must be true or false.')
}

function environmentInteger (
  value: string | undefined,
  fallback: number,
  allowZero: boolean
): number {
  if (value === undefined) return fallback
  const parsed = Number.parseInt(value, 10)
  if (!Number.isSafeInteger(parsed) || parsed < (allowZero ? 0 : 1)) {
    throw new Error('OpenAI numeric configuration is invalid.')
  }
  return parsed
}
