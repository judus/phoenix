import {
  CopilotProfileSelectionRequestSchema,
  CopilotProfilesResponseSchema,
  type CopilotProfilesResponse
} from '@phoenix/contracts'
import type { AgentProfileCatalog } from '@phoenix/copilot'
import type { SystemSettingsRepository } from '../domain/system-configuration.js'
import type { Unsubscribe } from '../domain/publisher.js'

export interface CopilotProfiles {
  activeProfileId(): string
  get(): CopilotProfilesResponse
  select(profileId: string): CopilotProfilesResponse
  subscribe(listener: (profiles: CopilotProfilesResponse) => void): Unsubscribe
}

export class CopilotProfileService implements CopilotProfiles {
  private readonly listeners = new Set<(profiles: CopilotProfilesResponse) => void>()
  public constructor (
    private readonly profiles: AgentProfileCatalog,
    private readonly settings: SystemSettingsRepository
  ) {}

  public activeProfileId (): string {
    const requested = this.settings.loadOrCreate().copilot.activeProfileId
    return this.profiles.list().some(profile => profile.id === requested)
      ? requested
      : this.profiles.list()[0]?.id ?? 'marin'
  }

  public get (): CopilotProfilesResponse {
    return CopilotProfilesResponseSchema.parse({
      activeProfileId: this.activeProfileId(),
      profiles: this.profiles.list()
    })
  }

  public select (profileId: string): CopilotProfilesResponse {
    const selected = CopilotProfileSelectionRequestSchema.parse({ profileId }).profileId
    if (!this.profiles.list().some(profile => profile.id === selected)) {
      throw new Error(`Unknown Copilot profile: ${selected}`)
    }
    const settings = this.settings.loadOrCreate()
    this.settings.save({ ...settings, copilot: { activeProfileId: selected } })
    const result = this.get()
    for (const listener of this.listeners) listener(result)
    return result
  }

  public subscribe (listener: (profiles: CopilotProfilesResponse) => void): Unsubscribe {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }
}
