import type { IncomingMessage, ServerResponse } from 'node:http'
import {
  CopilotSettingsSchema, CopilotSettingsUpdateSchema, EddnSettingsUpdateSchema,
  GeneralSettingsSchema, GeneralSettingsUpdateSchema, OpenAiApiKeyRequestSchema, PhoenixModulesSchema
} from '@phoenix/contracts'
import type { EddnContributionService } from '../application/eddn-contribution-service.js'
import type { OpenAiConfiguration } from '../application/openai-configuration-service.js'
import type { CopilotCapabilities } from '../domain/copilot-capabilities.js'
import type { SystemSettingsRepository } from '../domain/system-configuration.js'
import { readJsonBody, readValidatedJsonBody, writeJson } from './http-json.js'

export interface SettingsHttpServices {
  systemSettings: SystemSettingsRepository
  copilotCapabilities: CopilotCapabilities
  openAiConfiguration: OpenAiConfiguration
  eddn: Pick<EddnContributionService, 'status' | 'setEnabled'>
}

/** Called only after the server's pairing and delegated Control Deck checks. */
export async function handleSettingsRequest (
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  services: SettingsHttpServices
): Promise<boolean> {
  if (request.method === 'GET' && url.pathname === '/api/settings/eddn') {
    writeJson(response, 200, services.eddn.status())
    return true
  }

  if (request.method === 'PUT' && url.pathname === '/api/settings/eddn') {
    const input = await readValidatedJsonBody(request, EddnSettingsUpdateSchema)
    writeJson(response, 200, services.eddn.setEnabled(input.enabled))
    return true
  }

  if (request.method === 'GET' && url.pathname === '/api/settings/modules') {
    writeJson(response, 200, services.systemSettings.loadOrCreate().modules)
    return true
  }

  if (request.method === 'GET' && url.pathname === '/api/settings/general') {
    const settings = services.systemSettings.loadOrCreate()
    writeJson(response, 200, GeneralSettingsSchema.parse({ controlsEnabled: settings.controls.enabled }))
    return true
  }

  if (request.method === 'PUT' && url.pathname === '/api/settings/general') {
    try {
      const input = GeneralSettingsUpdateSchema.parse(await readJsonBody(request))
      const settings = services.systemSettings.loadOrCreate()
      services.systemSettings.save({
        ...settings,
        controls: { ...settings.controls, enabled: input.controlsEnabled }
      })
      writeJson(response, 200, GeneralSettingsSchema.parse(input))
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Invalid general settings.'
      writeJson(response, 400, { error: { code: 'invalid_general_settings', message } })
    }
    return true
  }

  if (request.method === 'GET' && url.pathname === '/api/settings/copilot') {
    const settings = services.systemSettings.loadOrCreate()
    const permissions = services.copilotCapabilities.normalizePolicy(settings.copilot.permissions)
    writeJson(response, 200, CopilotSettingsSchema.parse({
      provider: settings.copilot.provider,
      permissions,
      capabilities: services.copilotCapabilities.catalogue(),
      openAi: services.openAiConfiguration.status()
    }))
    return true
  }

  if (request.method === 'PUT' && url.pathname === '/api/settings/copilot') {
    try {
      const input = CopilotSettingsUpdateSchema.parse(await readJsonBody(request))
      const permissions = services.copilotCapabilities.saveInstallationPolicy(input.permissions)
      const settings = services.systemSettings.loadOrCreate()
      services.systemSettings.save({
        ...settings,
        copilot: { ...settings.copilot, provider: input.provider }
      })
      writeJson(response, 200, CopilotSettingsSchema.parse({
        provider: input.provider,
        permissions,
        capabilities: services.copilotCapabilities.catalogue(),
        openAi: services.openAiConfiguration.status()
      }))
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Invalid Copilot settings.'
      writeJson(response, 400, { error: { code: 'invalid_copilot_settings', message } })
    }
    return true
  }

  if (request.method === 'PUT' && url.pathname === '/api/settings/openai-key') {
    try {
      const { apiKey } = OpenAiApiKeyRequestSchema.parse(await readJsonBody(request))
      writeJson(response, 200, services.openAiConfiguration.save(apiKey))
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Invalid OpenAI API key.'
      writeJson(response, 400, { error: { code: 'invalid_openai_key', message } })
    }
    return true
  }

  if (request.method === 'DELETE' && url.pathname === '/api/settings/openai-key') {
    writeJson(response, 200, services.openAiConfiguration.remove())
    return true
  }

  if (request.method === 'PUT' && url.pathname === '/api/settings/modules') {
    try {
      const modules = PhoenixModulesSchema.parse(await readJsonBody(request))
      const settings = services.systemSettings.loadOrCreate()
      services.systemSettings.save({ ...settings, modules })
      writeJson(response, 200, modules)
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Invalid module settings.'
      writeJson(response, 400, { error: { code: 'invalid_module_settings', message } })
    }
    return true
  }

  return false
}
