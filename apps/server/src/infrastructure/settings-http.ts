import type { IncomingMessage, ServerResponse } from 'node:http'
import {
  CopilotAiProviderSchema, CopilotSettingsSchema, CopilotSettingsUpdateSchema, EddnSettingsUpdateSchema,
  GeneralSettingsSchema, GeneralSettingsUpdateSchema, OpenAiApiKeyRequestSchema, PhoenixModulesSchema
} from '@phoenix/contracts'
import type { EddnContributionService } from '../application/eddn-contribution-service.js'
import type { OpenAiConfiguration } from '../application/openai-configuration-service.js'
import type { CopilotProviderConfiguration } from '../application/copilot-provider-configuration.js'
import type { CopilotCapabilities } from '../domain/copilot-capabilities.js'
import type { SystemSettingsRepository } from '../domain/system-configuration.js'
import { readValidatedJsonBody, writeJson } from './http-json.js'

export interface SettingsHttpServices {
  systemSettings: SystemSettingsRepository
  copilotCapabilities: CopilotCapabilities
  openAiConfiguration: OpenAiConfiguration
  copilotProviderConfiguration: CopilotProviderConfiguration
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
    const input = await readValidatedJsonBody(request, GeneralSettingsUpdateSchema)
    const settings = services.systemSettings.loadOrCreate()
    services.systemSettings.save({
      ...settings,
      controls: { ...settings.controls, enabled: input.controlsEnabled }
    })
    writeJson(response, 200, GeneralSettingsSchema.parse(input))
    return true
  }

  if (request.method === 'GET' && url.pathname === '/api/settings/copilot') {
    const settings = services.systemSettings.loadOrCreate()
    const permissions = services.copilotCapabilities.normalizePolicy(settings.copilot.permissions)
    writeJson(response, 200, CopilotSettingsSchema.parse({
      provider: settings.copilot.provider,
      model: settings.copilot.model,
      providerKey: services.copilotProviderConfiguration.status(),
      restartRequired: services.copilotProviderConfiguration.restartRequired(),
      permissions,
      capabilities: services.copilotCapabilities.catalogue(),
      openAi: services.openAiConfiguration.status()
    }))
    return true
  }

  if (request.method === 'PUT' && url.pathname === '/api/settings/copilot') {
    const input = await readValidatedJsonBody(request, CopilotSettingsUpdateSchema)
    const permissions = services.copilotCapabilities.saveInstallationPolicy(input.permissions)
    const settings = services.systemSettings.loadOrCreate()
    services.systemSettings.save({
      ...settings,
      copilot: { ...settings.copilot, provider: input.provider, model: input.model }
    })
    writeJson(response, 200, CopilotSettingsSchema.parse({
      provider: input.provider,
      model: input.model,
      providerKey: services.copilotProviderConfiguration.status(),
      restartRequired: services.copilotProviderConfiguration.restartRequired(),
      permissions,
      capabilities: services.copilotCapabilities.catalogue(),
      openAi: services.openAiConfiguration.status()
    }))
    return true
  }

  const providerPath = /^\/api\/settings\/copilot\/providers\/([^/]+)\/key$/u.exec(url.pathname)
  if (providerPath && ['PUT', 'DELETE'].includes(request.method ?? '')) {
    const parsed = CopilotAiProviderSchema.safeParse(providerPath[1])
    if (!parsed.success) {
      writeJson(response, 400, { error: { code: 'invalid_provider', message: 'Unknown AI provider.' } })
      return true
    }
    const provider = parsed.data
    const configuration = services.copilotProviderConfiguration
    const status = request.method === 'PUT'
      ? configuration.save(provider, (await readValidatedJsonBody(request, OpenAiApiKeyRequestSchema)).apiKey)
      : configuration.remove(provider)
    writeJson(response, 200, status)
    return true
  }

  if (request.method === 'PUT' && url.pathname === '/api/settings/openai-key') {
    const { apiKey } = await readValidatedJsonBody(request, OpenAiApiKeyRequestSchema)
    writeJson(response, 200, services.openAiConfiguration.save(apiKey))
    return true
  }

  if (request.method === 'DELETE' && url.pathname === '/api/settings/openai-key') {
    writeJson(response, 200, services.openAiConfiguration.remove())
    return true
  }

  if (request.method === 'PUT' && url.pathname === '/api/settings/modules') {
    const modules = await readValidatedJsonBody(request, PhoenixModulesSchema)
    const settings = services.systemSettings.loadOrCreate()
    services.systemSettings.save({ ...settings, modules })
    writeJson(response, 200, modules)
    return true
  }

  return false
}
