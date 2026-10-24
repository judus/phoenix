import type { CopilotAiProvider, OpenAiConfigurationStatus } from '@phoenix/contracts'
import type { OpenAiConfiguration } from './openai-configuration-service.js'
import type { SystemSettingsRepository } from '../domain/system-configuration.js'

interface KeyRepository { get(): string | undefined, save(key: string): void, remove(): void }
export interface CopilotProviderSelection { provider: CopilotAiProvider, model: string, apiKey?: string }

export class CopilotProviderConfiguration {
  private readonly initial: CopilotProviderSelection
  private readonly activeKeys: Record<CopilotAiProvider, string | undefined>
  public constructor (private readonly settings: SystemSettingsRepository, private readonly openAi: OpenAiConfiguration,
    private readonly secrets: Record<'anthropic' | 'google', KeyRepository>,
    private readonly environment: Partial<Record<CopilotAiProvider, string>> = {}) {
    this.activeKeys = { openai: openAi.activeApiKey(), anthropic: this.desiredKey('anthropic'), google: this.desiredKey('google') }
    const selected = settings.loadOrCreate().copilot
    this.initial = { provider: selected.provider, model: selected.model, apiKey: this.activeKeys[selected.provider] }
  }
  public active (): CopilotProviderSelection { return { ...this.initial } }
  public restartRequired (): boolean {
    const selected = this.settings.loadOrCreate().copilot
    return selected.provider !== this.initial.provider || selected.model !== this.initial.model || this.status(selected.provider).restartRequired
  }
  public status (provider = this.settings.loadOrCreate().copilot.provider): OpenAiConfigurationStatus {
    if (provider === 'openai') return this.openAi.status()
    const stored = this.secrets[provider].get()
    return { configured: this.desiredKey(provider) !== undefined, stored: stored !== undefined,
      source: stored !== undefined ? 'stored' : this.environment[provider] ? 'environment' : 'none',
      restartRequired: this.desiredKey(provider) !== this.activeKeys[provider] }
  }
  public save (provider: CopilotAiProvider, key: string): OpenAiConfigurationStatus {
    if (provider === 'openai') return this.openAi.save(key)
    this.secrets[provider].save(key)
    return this.status(provider)
  }
  public remove (provider: CopilotAiProvider): OpenAiConfigurationStatus {
    if (provider === 'openai') return this.openAi.remove()
    this.secrets[provider].remove()
    return this.status(provider)
  }
  private desiredKey (provider: 'anthropic' | 'google'): string | undefined { return this.secrets[provider].get() ?? this.environment[provider] }
}
