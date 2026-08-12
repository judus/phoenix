import { appendFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { createAiClient, type AiClient, type ToolRegistry } from '@maduser/ai-ts'
import { openAI } from '@maduser/ai-ts/providers/openai'
import {
  AgentPromptComposer,
  FileAgentProfileRepository,
  RuntimeContextRenderer,
  TextCopilotPipeline,
  type CopilotAiClientFactory
} from '@phoenix/copilot'
import { CopilotTextService, type CopilotText } from '../application/copilot-text-service.js'
import { CopilotRealtimeService, type CopilotRealtime } from '../application/copilot-realtime-service.js'
import type { RuntimeStateReader } from '../domain/runtime-state.js'
import { readCopilotAudioProcessing } from './copilot-audio-config.js'
import { JsonConversationStore } from './json-conversation-store.js'
import { OpenAiRealtimeClient } from './openai-realtime-client.js'

export interface ConfiguredCopilot {
  realtime: CopilotRealtime
  text: CopilotText
}

export interface ConfiguredCopilotOptions {
  agentsDirectory?: string
  apiKey?: string
  conversationsDirectory?: string
  maxRetries?: number
  mcpUrl?: string
  model?: string
  runtimeState: RuntimeStateReader
  timeoutMs?: number
  tools: ToolRegistry
  wireLogEnabled?: boolean
  wireLogFile?: string
}

export function createConfiguredCopilot (
  projectRoot: string,
  options: ConfiguredCopilotOptions
): ConfiguredCopilot | undefined {
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
  const profiles = new FileAgentProfileRepository(
    resolve(projectRoot, options.agentsDirectory ?? 'agents')
  )
  const prompts = new AgentPromptComposer(profiles)
  const runtimeContext = new RuntimeContextRenderer()
  const clients: CopilotAiClientFactory = {
    create: (instructions: string): AiClient => createAiClient({
      history: {
        maxContextTokens: 100_000,
        repository: conversations
      },
      instructions,
      ...(options.mcpUrl === undefined ? {} : {
        mcp: [{ name: 'phoenix', url: options.mcpUrl }]
      }),
      provider
    })
  }
  const pipeline = new TextCopilotPipeline(
    clients,
    prompts,
    runtimeContext
  )
  return {
    text: new CopilotTextService(pipeline, options.runtimeState, conversations),
    realtime: new CopilotRealtimeService({
      audioProcessing: readCopilotAudioProcessing(resolve(
        projectRoot,
        options.agentsDirectory ?? 'agents',
        'marin',
        'audio.json'
      )),
      conversations,
      gateway: new OpenAiRealtimeClient({ apiKey, wireLogger }),
      model: process.env.PHOENIX_OPENAI_REALTIME_MODEL ?? 'gpt-realtime-2.1-mini',
      prompts,
      runtimeContext,
      runtimeState: options.runtimeState,
      tools: options.tools,
      voice: process.env.PHOENIX_OPENAI_REALTIME_VOICE ?? 'marin'
    })
  }
}

function createWireLogger (file: string): (event: unknown) => void {
  mkdirSync(dirname(file), { recursive: true })
  return (event: unknown): void => {
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
