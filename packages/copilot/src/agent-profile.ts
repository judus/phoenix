import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export type CopilotMode = 'speech' | 'text'

export interface AgentProfile {
  agent: string
  characterSpeech: string
  characterText: string
  operational: string
  prologue: string
}

export interface AgentProfileDescriptor {
  description: string
  id: string
  mark: string
  name: string
  voice: string
}

export interface AgentProfileRepository {
  get(profileId: string): AgentProfile
}

export interface AgentProfileCatalog extends AgentProfileRepository {
  getDescriptor(profileId: string): AgentProfileDescriptor
  list(): readonly AgentProfileDescriptor[]
}

export interface EditableAgentProfile {
  characterSpeech: string
  characterText: string
  descriptor: AgentProfileDescriptor
}

export interface AgentProfileEditor extends AgentProfileCatalog {
  create(profile: EditableAgentProfile, templateProfileId: string): EditableAgentProfile
  getEditable(profileId: string): EditableAgentProfile
  update(profile: EditableAgentProfile): EditableAgentProfile
}

export interface ComposeAgentPrompt {
  mode: CopilotMode
  profileId: string
  runtimeContext?: string
}

const PLACEHOLDER_PATTERN = /\{\{\s*([^{}]+?)\s*\}\}/gu

export class AgentPromptComposer {
  public constructor (private readonly profiles: AgentProfileRepository) {}

  public compose ({ mode, profileId, runtimeContext }: ComposeAgentPrompt): string {
    const profile = this.profiles.get(profileId)
    return profile.agent.replace(PLACEHOLDER_PATTERN, (_placeholder, name: string) => {
      switch (name) {
        case 'PROLOGUE': return profile.prologue
        case 'OPERATIONAL': return profile.operational
        case 'CHARACTER': return mode === 'speech' ? profile.characterSpeech : profile.characterText
        case 'RUNTIME_CONTEXT': return runtimeContext?.trim() ?? ''
        default: throw new Error(`Unknown agent prompt placeholder: ${name}`)
      }
    }).trim()
  }
}

export class FileAgentProfileRepository implements AgentProfileEditor {
  public constructor (private readonly profilesDirectory: string) {}

  public get (profileId: string): AgentProfile {
    validateProfileId(profileId)
    const directory = join(this.profilesDirectory, profileId)
    return {
      agent: readRequired(join(directory, 'agent.md')),
      characterSpeech: readRequired(join(directory, 'character.speech.md')),
      characterText: readRequired(join(directory, 'character.text.md')),
      operational: readRequired(join(directory, 'operational.md')),
      prologue: readRequired(join(directory, 'prologue.md'))
    }
  }

  public getDescriptor (profileId: string): AgentProfileDescriptor {
    validateProfileId(profileId)
    const candidate = JSON.parse(readRequired(join(this.profilesDirectory, profileId, 'profile.json'))) as unknown
    if (!isRecord(candidate) || candidate.id !== profileId || typeof candidate.name !== 'string' ||
      typeof candidate.mark !== 'string' || typeof candidate.voice !== 'string') {
      throw new Error(`Invalid agent profile metadata: ${profileId}`)
    }
    return {
      description: typeof candidate.description === 'string' ? candidate.description : '',
      id: profileId,
      mark: candidate.mark,
      name: candidate.name,
      voice: candidate.voice
    }
  }

  public list (): readonly AgentProfileDescriptor[] {
    return readdirSync(this.profilesDirectory, { withFileTypes: true })
      .filter(entry => entry.isDirectory() && /^[a-z][a-z0-9_-]*$/u.test(entry.name))
      .map(entry => this.getDescriptor(entry.name))
      .sort((left, right) => left.name.localeCompare(right.name))
  }

  public getEditable (profileId: string): EditableAgentProfile {
    const profile = this.get(profileId)
    return {
      characterSpeech: profile.characterSpeech,
      characterText: profile.characterText,
      descriptor: this.getDescriptor(profileId)
    }
  }

  public create (profile: EditableAgentProfile, templateProfileId: string): EditableAgentProfile {
    validateEditable(profile)
    validateProfileId(templateProfileId)
    const directory = join(this.profilesDirectory, profile.descriptor.id)
    if (existsSync(directory)) throw new Error(`Agent profile already exists: ${profile.descriptor.id}`)
    const template = join(this.profilesDirectory, templateProfileId)
    this.get(templateProfileId)
    mkdirSync(directory)
    try {
      for (const filename of ['agent.md', 'operational.md', 'prologue.md', 'audio.json']) {
        copyFileSync(join(template, filename), join(directory, filename))
      }
      this.writeEditable(profile)
      return this.getEditable(profile.descriptor.id)
    } catch (cause) {
      rmSync(directory, { force: true, recursive: true })
      throw new Error(`Unable to create agent profile: ${profile.descriptor.id}`, { cause })
    }
  }

  public update (profile: EditableAgentProfile): EditableAgentProfile {
    validateEditable(profile)
    this.get(profile.descriptor.id)
    this.writeEditable(profile)
    return this.getEditable(profile.descriptor.id)
  }

  private writeEditable (profile: EditableAgentProfile): void {
    const directory = join(this.profilesDirectory, profile.descriptor.id)
    writeAtomically(join(directory, 'profile.json'), `${JSON.stringify(profile.descriptor, null, 2)}\n`)
    writeAtomically(join(directory, 'character.text.md'), `${profile.characterText.trim()}\n`)
    writeAtomically(join(directory, 'character.speech.md'), `${profile.characterSpeech.trim()}\n`)
  }
}

function validateProfileId (profileId: string): void {
  if (!/^[a-z][a-z0-9_-]*$/u.test(profileId)) throw new Error(`Invalid agent profile ID: ${profileId}`)
}

function isRecord (candidate: unknown): candidate is Record<string, unknown> {
  return typeof candidate === 'object' && candidate !== null && !Array.isArray(candidate)
}

function validateEditable (profile: EditableAgentProfile): void {
  validateProfileId(profile.descriptor.id)
  for (const value of [profile.descriptor.name, profile.descriptor.mark, profile.descriptor.voice,
    profile.characterSpeech, profile.characterText]) {
    if (!value.trim()) throw new Error(`Agent profile ${profile.descriptor.id} contains an empty required field.`)
  }
}

function writeAtomically (path: string, content: string): void {
  const temporary = `${path}.tmp`
  writeFileSync(temporary, content, 'utf8')
  renameSync(temporary, path)
}

function readRequired (path: string): string {
  try {
    return readFileSync(path, 'utf8').trim()
  } catch (cause) {
    throw new Error(`Unable to read agent profile file: ${path}`, { cause })
  }
}
