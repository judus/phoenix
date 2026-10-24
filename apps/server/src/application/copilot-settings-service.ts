import { CopilotSettingsSchema, PhoenixSettingsSchema, type CopilotSettingsUpdate, type PhoenixSettings } from '@phoenix/contracts'
import type { CopilotCapabilities } from '../domain/copilot-capabilities.js'
import type { SystemSettingsRepository } from '../domain/system-configuration.js'
import { SettingsCommittedError } from '../domain/settings-committed-error.js'
import type { CopilotProviderConfiguration } from './copilot-provider-configuration.js'
import type { OpenAiConfiguration } from './openai-configuration-service.js'

/** One settings document is the commit boundary for provider/model and permission ceilings. */
export class CopilotSettingsService {
  public constructor (
    private readonly settings: SystemSettingsRepository,
    private readonly capabilities: CopilotCapabilities,
    private readonly providers: CopilotProviderConfiguration,
    private readonly openAi: OpenAiConfiguration
  ) {}

  public get () { return this.snapshot(this.settings.loadOrCreate()) }

  public save (input: CopilotSettingsUpdate) {
    const settings = this.settings.loadOrCreate()
    const policy = this.capabilities.prepareInstallationPolicy(input.permissions, settings.copilot.profilePermissions)
    const next = PhoenixSettingsSchema.parse({
      ...settings,
      copilot: { ...settings.copilot, ...policy, provider: input.provider, model: input.model }
    })
    this.settings.save(next)
    try { return this.snapshot(next) }
    catch (cause) { throw new SettingsCommittedError('response', cause) }
  }

  private snapshot (settings: PhoenixSettings) {
    return CopilotSettingsSchema.parse({
      provider: settings.copilot.provider,
      model: settings.copilot.model,
      providerKey: this.providers.status(),
      restartRequired: this.providers.restartRequired(),
      permissions: this.capabilities.normalizePolicy(settings.copilot.permissions),
      capabilities: this.capabilities.catalogue(),
      openAi: this.openAi.status()
    })
  }
}
