import type { OpenAiConfigurationStatus } from '@phoenix/contracts'
import type { OpenAiSecretRepository } from '../domain/system-configuration.js'

export interface OpenAiConfiguration {
  activeApiKey(): string | undefined
  status(): OpenAiConfigurationStatus
  save(apiKey: string): OpenAiConfigurationStatus
  remove(): OpenAiConfigurationStatus
}

export class OpenAiConfigurationService implements OpenAiConfiguration {
  private readonly activeKey: string | undefined

  public constructor (
    private readonly secrets: OpenAiSecretRepository,
    private readonly environmentKey?: string
  ) {
    this.activeKey = this.desiredKey()
  }

  public activeApiKey (): string | undefined { return this.activeKey }

  public status (): OpenAiConfigurationStatus {
    const stored = this.secrets.get()
    const desired = stored ?? this.environmentKey
    return {
      configured: desired !== undefined,
      source: stored !== undefined ? 'stored' : this.environmentKey !== undefined ? 'environment' : 'none',
      stored: stored !== undefined,
      restartRequired: desired !== this.activeKey
    }
  }

  public save (apiKey: string): OpenAiConfigurationStatus {
    this.secrets.save(apiKey)
    return this.status()
  }

  public remove (): OpenAiConfigurationStatus {
    this.secrets.remove()
    return this.status()
  }

  private desiredKey (): string | undefined {
    return this.secrets.get() ?? this.environmentKey
  }
}
