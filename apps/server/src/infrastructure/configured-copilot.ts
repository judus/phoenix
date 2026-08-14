import { resolve } from 'node:path'
import { createAiClient, type AiClient, type ToolRegistry } from '@judus/llm-client'
import { openAI } from '@judus/llm-client/providers/openai'
import {
  AgentPromptComposer,
  FileAgentProfileRepository,
  RuntimeContextRenderer,
  TextCopilotPipeline,
  type CopilotAiClientFactory
} from '@phoenix/copilot'
import { CopilotTextService, type CopilotText } from '../application/copilot-text-service.js'
import { CopilotProfileService, type CopilotProfiles } from '../application/copilot-profile-service.js'
import { CopilotRealtimeService, type CopilotRealtime } from '../application/copilot-realtime-service.js'
import type { RuntimeStateReader } from '../domain/runtime-state.js'
import type { SystemSettingsRepository } from '../domain/system-configuration.js'
import type { MissionDataReader } from '../domain/missions.js'
import { MissionRuntimeContext } from '../application/mission-runtime-context.js'
import { readCopilotAudioProcessing } from './copilot-audio-config.js'
import { JsonConversationStore } from './json-conversation-store.js'
import { OpenAiRealtimeClient } from './openai-realtime-client.js'
import { RotatingWireLogger } from './rotating-wire-logger.js'
import type { ApplicationPaths } from './application-paths.js'

export interface ConfiguredCopilot {
  profiles: CopilotProfiles
  realtime: CopilotRealtime
  text: CopilotText
}

export interface ConfiguredCopilotOptions {
  agentsDirectory?: string
  apiKey?: string
  conversationsDirectory?: string
  maxRetries?: number
  mcpUrl?: string
  mcpToken?: string
  model?: string
  missions: MissionDataReader
  runtimeState: RuntimeStateReader
  systemSettings: SystemSettingsRepository
  timeoutMs?: number
  tools: ToolRegistry
  wireLogEnabled?: boolean
  wireLogFile?: string
  wireLogMaxBytes?: number
  wireLogMaxFiles?: number
}

export function createConfiguredCopilot (
  paths: ApplicationPaths,
  options: ConfiguredCopilotOptions
): ConfiguredCopilot | undefined {
  const apiKey = options.apiKey ?? process.env.PHOENIX_OPENAI_API_KEY ?? process.env.OPENAI_API_KEY
  if (!apiKey) return undefined

  const conversations = new JsonConversationStore(
    resolve(paths.user.data, options.conversationsDirectory ?? 'conversations')
  )
  const wireLogger = (options.wireLogEnabled ?? environmentBoolean(
    process.env.PHOENIX_OPENAI_WIRE_LOG_ENABLED,
    false
  ))
    ? new RotatingWireLogger({
        file: resolve(paths.user.logs, options.wireLogFile ?? 'openai-wire.ndjson'),
        maxBytes: options.wireLogMaxBytes ?? environmentInteger(
          process.env.PHOENIX_OPENAI_WIRE_LOG_MAX_BYTES,
          25 * 1024 * 1024,
          false
        ),
        maxFiles: options.wireLogMaxFiles ?? environmentInteger(
          process.env.PHOENIX_OPENAI_WIRE_LOG_MAX_FILES,
          3,
          false
        )
      }).write
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
    resolve(paths.resources.agents, options.agentsDirectory ?? '.')
  )
  const prompts = new AgentPromptComposer(profiles)
  const profileService = new CopilotProfileService(profiles, options.systemSettings)
  const runtimeContext = new RuntimeContextRenderer([new MissionRuntimeContext(options.missions)])
  const clients: CopilotAiClientFactory = {
    create: (instructions: string): AiClient => createAiClient({
      history: {
        maxContextTokens: 100_000,
        repository: conversations
      },
      instructions,
      ...(options.mcpUrl === undefined ? {} : {
        mcp: [{
          name: 'phoenix',
          url: options.mcpUrl,
          ...(options.mcpToken === undefined ? {} : {
            headers: { authorization: `Bearer ${options.mcpToken}` }
          })
        }]
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
    profiles: profileService,
    text: new CopilotTextService(pipeline, options.runtimeState, conversations, () => profileService.activeProfileId()),
    realtime: new CopilotRealtimeService({
      activeProfileId: () => profileService.activeProfileId(),
      audioProcessing: profileId => readCopilotAudioProcessing(resolve(
        paths.resources.agents, options.agentsDirectory ?? '.', profileId, 'audio.json'
      )),
      conversations,
      gateway: new OpenAiRealtimeClient({ apiKey, wireLogger }),
      model: process.env.PHOENIX_OPENAI_REALTIME_MODEL ?? 'gpt-realtime-2.1-mini',
      prompts,
      runtimeContext,
      runtimeState: options.runtimeState,
      tools: options.tools,
      voice: profileId => process.env.PHOENIX_OPENAI_REALTIME_VOICE ?? profiles.getDescriptor(profileId).voice
    })
  }
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
