import {
  CopilotProfileSelectionRequestSchema,
  CopilotProfileDocumentSchema,
  CopilotProfileWriteRequestSchema,
  CopilotProfilesResponseSchema,
  type CopilotProfileDocument,
  type CopilotProfileWriteRequest,
  type CopilotProfilesResponse
} from '@phoenix/contracts'
import type { AgentProfileEditor } from '@phoenix/copilot'
import type { SystemSettingsRepository } from '../domain/system-configuration.js'
import type { Unsubscribe } from '../domain/publisher.js'

export interface CopilotProfiles {
  activeProfileId(): string
  get(): CopilotProfilesResponse
  getDocument(profileId: string): CopilotProfileDocument
  create(input: CopilotProfileWriteRequest): CopilotProfileDocument
  update(profileId: string, input: CopilotProfileWriteRequest): CopilotProfileDocument
  select(profileId: string): CopilotProfilesResponse
  subscribe(listener: (profiles: CopilotProfilesResponse) => void): Unsubscribe
}

export class CopilotProfileService implements CopilotProfiles {
  private readonly listeners = new Set<(profiles: CopilotProfilesResponse) => void>()
  public constructor (
    private readonly profiles: AgentProfileEditor,
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
    this.settings.save({ ...settings, copilot: { ...settings.copilot, activeProfileId: selected } })
    const result = this.get()
    this.publish(result)
    return result
  }

  public getDocument (profileId: string): CopilotProfileDocument {
    const editable = this.profiles.getEditable(profileId)
    return CopilotProfileDocumentSchema.parse({
      characterSpeech: editable.characterSpeech,
      characterText: editable.characterText,
      profile: editable.descriptor
    })
  }

  public create (candidate: CopilotProfileWriteRequest): CopilotProfileDocument {
    const input = CopilotProfileWriteRequestSchema.parse(candidate)
    const created = this.profiles.create({
      characterSpeech: input.characterSpeech,
      characterText: input.characterText,
      descriptor: input.profile
    }, input.templateProfileId ?? this.activeProfileId())
    const document = CopilotProfileDocumentSchema.parse({
      characterSpeech: created.characterSpeech,
      characterText: created.characterText,
      profile: created.descriptor
    })
    this.publish(this.get())
    return document
  }

  public update (profileId: string, candidate: CopilotProfileWriteRequest): CopilotProfileDocument {
    const input = CopilotProfileWriteRequestSchema.parse(candidate)
    if (input.profile.id !== profileId) throw new Error('Copilot profile ID cannot be changed.')
    const updated = this.profiles.update({
      characterSpeech: input.characterSpeech,
      characterText: input.characterText,
      descriptor: input.profile
    })
    const document = CopilotProfileDocumentSchema.parse({
      characterSpeech: updated.characterSpeech,
      characterText: updated.characterText,
      profile: updated.descriptor
    })
    this.publish(this.get())
    return document
  }

  public subscribe (listener: (profiles: CopilotProfilesResponse) => void): Unsubscribe {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }
  private publish (result: CopilotProfilesResponse): void {
    for (const listener of this.listeners) listener(result)
  }
}
