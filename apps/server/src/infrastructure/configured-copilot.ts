import { resolve } from 'node:path'
import type { ToolRegistry } from '@jdu/llm-client'
import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import type { LanguageModel } from 'ai'
import type { CopilotProviderSelection } from '../application/copilot-provider-configuration.js'
import {
  AgentPromptComposer,
  FileAgentProfileRepository,
  RuntimeContextRenderer,
  TextCopilotPipeline
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
import { AiSdkCopilotClientFactory } from './ai-sdk-copilot-client.js'
import { AiSdkRealtimeClient } from './ai-sdk-realtime-client.js'
import { OpenAiRealtimeClient } from './openai-realtime-client.js'
import { RotatingWireLogger } from './rotating-wire-logger.js'
import type { ApplicationPaths } from './application-paths.js'
import { prepareWritableAgentProfiles } from './writable-agent-profiles.js'

export interface ConfiguredCopilot {
  profiles: CopilotProfiles
  realtime?: CopilotRealtime
  text?: CopilotText
}

export interface ConfiguredCopilotOptions {
  agentsDirectory?: string
  apiKey?: string
  textProvider?: CopilotProviderSelection
  realtimeBackend?: 'native' | 'ai-sdk'
  conversationsDirectory?: string
  model?: string
  missions: MissionDataReader
  profilesDirectory?: string
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
  const realtimeBackend = options.realtimeBackend ?? process.env.PHOENIX_REALTIME_BACKEND ?? 'native'
  if (realtimeBackend !== 'native' && realtimeBackend !== 'ai-sdk') throw new Error('Unknown PHOENIX_REALTIME_BACKEND. Use native or ai-sdk.')
  const textProvider = options.textProvider ?? { provider: 'openai', apiKey,
    model: options.model ?? process.env.PHOENIX_OPENAI_MODEL ?? 'gpt-5.6-terra' }
  if (textProvider.provider === 'openai' && !textProvider.model) {
    textProvider.model = options.model ?? process.env.PHOENIX_OPENAI_MODEL ?? 'gpt-5.6-terra'
  }
  if (!apiKey && !textProvider.apiKey) return undefined

  const profilesDirectory = prepareWritableAgentProfiles(
    resolve(paths.resources.copilots, options.agentsDirectory ?? '.'),
    // Keep the persisted location: moving bundled resources must not reset edited profiles.
    resolve(paths.user.data, options.profilesDirectory ?? 'copilot/agents')
  )

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
  const profiles = new FileAgentProfileRepository(profilesDirectory)
  const prompts = new AgentPromptComposer(profiles)
  const profileService = new CopilotProfileService(profiles, options.systemSettings)
  const runtimeContext = new RuntimeContextRenderer([new MissionRuntimeContext(options.missions)])
  const clients = textProvider.apiKey && textProvider.model ? new AiSdkCopilotClientFactory({
    model: createCopilotModel(textProvider),
    conversations,
    tools: options.tools,
    timeoutMs: options.timeoutMs ?? environmentInteger(process.env.PHOENIX_OPENAI_TIMEOUT_MS, 180_000, false)
  }) : undefined
  const pipeline = clients ? new TextCopilotPipeline(
    clients,
    prompts,
    runtimeContext
  ) : undefined
  return {
    profiles: profileService,
    text: pipeline ? new CopilotTextService(pipeline, options.runtimeState, conversations, () => profileService.activeProfileId()) : undefined,
    realtime: apiKey ? new CopilotRealtimeService({
      activeProfileId: () => profileService.activeProfileId(),
      audioProcessing: profileId => readCopilotAudioProcessing(resolve(profilesDirectory, profileId, 'audio.json')),
      conversations,
      gateway: realtimeBackend === 'ai-sdk' ? new AiSdkRealtimeClient({ apiKey, wireLogger })
        : new OpenAiRealtimeClient({ apiKey, wireLogger }),
      model: process.env.PHOENIX_OPENAI_REALTIME_MODEL ?? 'gpt-realtime-2.1-mini',
      prompts,
      runtimeContext,
      runtimeState: options.runtimeState,
      tools: options.tools,
      voice: profileId => process.env.PHOENIX_OPENAI_REALTIME_VOICE ?? profiles.getDescriptor(profileId).voice
    }) : undefined
  }
}

export function createCopilotModel (selection: CopilotProviderSelection): LanguageModel {
  if (!selection.apiKey || !selection.model) throw new Error('Copilot requires a provider API key and model ID.')
  switch (selection.provider) {
    case 'openai': return createOpenAI({ apiKey: selection.apiKey }).responses(selection.model)
    case 'anthropic': return createAnthropic({ apiKey: selection.apiKey })(selection.model)
    case 'google': return createGoogleGenerativeAI({ apiKey: selection.apiKey })(selection.model)
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
