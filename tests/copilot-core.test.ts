import { expect, test } from 'vitest'
import { resolve } from 'node:path'
import { createEmptyRuntimeState } from '@phoenix/contracts'
import type { AiResult, AiStreamEvent } from '@maduser/ai-ts'
import {
  AgentPromptComposer,
  FileAgentProfileRepository,
  RuntimeContextRenderer,
  TextCopilotPipeline,
  type AgentProfile,
  type AgentProfileRepository,
  type CopilotAiClient,
  type CopilotAiClientFactory,
  type CopilotAiRequest
} from '../packages/copilot/src/index.js'

const profile: AgentProfile = {
  agent: '{{ PROLOGUE }}\n{{ OPERATIONAL }}\n{{ CHARACTER }}\n{{ RUNTIME_CONTEXT }}',
  prologue: 'PROLOGUE',
  operational: 'OPERATIONS',
  characterText: 'TEXT CHARACTER',
  characterSpeech: 'SPEECH CHARACTER'
}

test('agent prompts compose mode-specific character and dynamic runtime context', () => {
  const composer = new AgentPromptComposer(new StaticProfileRepository())

  expect(composer.compose({
    mode: 'speech',
    profileId: 'icarus',
    runtimeContext: 'LIVE STATE'
  })).toBe('PROLOGUE\nOPERATIONS\nSPEECH CHARACTER\nLIVE STATE')

  expect(() => new AgentPromptComposer(new StaticProfileRepository({
    ...profile,
    agent: '{{ UNKNOWN }}'
  })).compose({ mode: 'text', profileId: 'icarus' })).toThrow('Unknown agent prompt placeholder')
})

test('tracked agent profile files compose and reject unsafe profile IDs', () => {
  const repository = new FileAgentProfileRepository(resolve('agents'))
  const composer = new AgentPromptComposer(repository)

  const prompt = composer.compose({
    mode: 'text',
    profileId: 'icarus',
    runtimeContext: 'LIVE STATE'
  })

  expect(prompt).toContain('You are ICARUS.')
  expect(prompt).toContain('LIVE STATE')
  expect(prompt).not.toContain('{{')
  expect(() => repository.get('../icarus')).toThrow('Invalid agent profile ID')
})

test('runtime context renders typed PHOENIX state without legacy compatibility shapes', () => {
  const empty = createEmptyRuntimeState()
  const state = {
    ...empty,
    revision: 42,
    updatedAt: '2026-08-10T20:00:00.000Z',
    commander: {
      ...empty.commander,
      name: 'Maduser',
      ranks: { ...empty.commander.ranks, combat: 6 },
      rankProgress: { ...empty.commander.rankProgress, combat: 73 }
    },
    system: {
      ...empty.system,
      name: 'Sol',
      population: 22_780_000_000,
      security: { id: '$SYSTEM_SECURITY_high;', label: 'High Security' }
    },
    location: {
      state: 'docked' as const,
      place: {
        kind: 'station' as const,
        name: 'Galileo',
        type: 'Coriolis Starport',
        marketId: 1,
        faction: null,
        government: null,
        primaryEconomy: null,
        economies: [],
        services: ['refuel', 'repair', 'outfitting']
      }
    },
    ship: {
      ...empty.ship,
      name: 'Prospector',
      identifier: 'M4D-42',
      maxJumpRange: 31.5,
      cargoCapacity: 196
    }
  }

  const rendered = new RuntimeContextRenderer().render(state)

  expect(rendered).toContain('Combat Dangerous (73%)')
  expect(rendered).toContain('Name: Sol')
  expect(rendered).toContain('Station: Galileo · Coriolis Starport')
  expect(rendered).toContain('Services: Refuel, Repair, Outfitting')
  expect(rendered).toContain('Registration: M4D-42')
  expect(rendered).toContain('31.5 Ly jump range')
  expect(rendered).not.toContain('undefined')
})

test('text pipeline delegates execution and streaming to maduser-ai-ts-compatible clients', async () => {
  const factory = new RecordingClientFactory()
  const pipeline = new TextCopilotPipeline(
    factory,
    new AgentPromptComposer(new StaticProfileRepository()),
    new RuntimeContextRenderer()
  )
  const turn = {
    conversationId: 'bridge-log',
    message: 'Status report.',
    profileId: 'icarus',
    runtimeState: createEmptyRuntimeState()
  }

  await pipeline.run(turn)
  for await (const _event of pipeline.stream(turn)) {}

  expect(factory.instructions).toContain('TEXT CHARACTER')
  expect(factory.instructions).toContain('## Runtime Context')
  expect(factory.requests).toEqual([
    { conversationId: 'bridge-log', message: 'Status report.', method: 'run' },
    { conversationId: 'bridge-log', message: 'Status report.', method: 'stream' }
  ])
})

class StaticProfileRepository implements AgentProfileRepository {
  public constructor (private readonly value = profile) {}
  public get (_profileId: string): AgentProfile { return this.value }
}

class RecordingClientFactory implements CopilotAiClientFactory {
  public instructions = ''
  public readonly requests: Array<{ conversationId?: string, message: string, method: string }> = []

  public create (instructions: string): CopilotAiClient {
    this.instructions = instructions
    return {
      chat: conversationId => ({
        user: message => this.request(message, conversationId)
      }),
      user: message => this.request(message)
    }
  }

  private request (message: string, conversationId?: string): CopilotAiRequest {
    return {
      run: async () => {
        this.requests.push({ conversationId, message, method: 'run' })
        return {} as AiResult
      },
      stream: async function * (this: RecordingClientFactory) {
        this.requests.push({ conversationId, message, method: 'stream' })
        if (false) yield {} as AiStreamEvent
      }.bind(this)
    }
  }
}
