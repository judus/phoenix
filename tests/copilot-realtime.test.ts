import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from 'vitest'
import { ToolRegistry, type JsonObject } from '@maduser/ai-ts'
import type {
  CopilotAudioProcessing,
  CopilotRealtimeTokenRequest,
  CopilotRealtimeToolRequest,
  CopilotRealtimeTurnRequest
} from '@phoenix/contracts'
import { AgentPromptComposer, FileAgentProfileRepository, RuntimeContextRenderer } from '@phoenix/copilot'
import {
  CopilotRealtimeService,
  type CopilotRealtime,
  type RealtimeClientSecretGateway
} from '../apps/server/src/application/copilot-realtime-service.js'
import { readCopilotAudioProcessing } from '../apps/server/src/infrastructure/copilot-audio-config.js'
import { InMemoryRuntimeStateStore } from '../apps/server/src/infrastructure/in-memory-runtime-state-store.js'
import { JsonConversationStore } from '../apps/server/src/infrastructure/json-conversation-store.js'
import { PhoenixApplication } from '../apps/server/src/phoenix-application.js'

const projectRoot = fileURLToPath(new URL('../', import.meta.url))
const audioProcessing = readCopilotAudioProcessing(join(projectRoot, 'agents/icarus/audio.json'))

test('Realtime composition shares profiles, telemetry, tools, and conversation persistence', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'phoenix-realtime-'))
  const gateway = new RecordingRealtimeGateway()
  const conversations = new JsonConversationStore(directory)
  const tools = new ToolRegistry([{
    definition: {
      description: 'Return a test status.',
      inputSchema: { additionalProperties: false, properties: {}, type: 'object' },
      name: 'commander.test_status'
    },
    execute: () => ({
      content: [{ source: 'generated', text: 'All clear.', type: 'text' }],
      structuredContent: { clear: true }
    })
  }])
  const service = new CopilotRealtimeService({
    audioProcessing,
    conversations,
    gateway,
    model: 'gpt-realtime-test',
    prompts: new AgentPromptComposer(new FileAgentProfileRepository(join(projectRoot, 'agents'))),
    runtimeContext: new RuntimeContextRenderer(),
    runtimeState: new InMemoryRuntimeStateStore(),
    tools,
    voice: 'marin'
  })

  try {
    const token = await service.createToken({ conversationId: 'realtime-test' })
    expect(token).toEqual({ value: 'ephemeral-test', model: 'gpt-realtime-test', expiresAt: 123 })
    expect(gateway.session).toMatchObject({
      session: {
        model: 'gpt-realtime-test',
        output_modalities: ['audio'],
        tools: [{ name: 'phoenix_commander_test_status', type: 'function' }],
        type: 'realtime'
      }
    })
    expect(JSON.stringify(gateway.session)).toContain('gruff, mildly annoyed tone')

    await expect(service.executeTool({
      arguments: {},
      name: 'phoenix_commander_test_status'
    })).resolves.toMatchObject({ structuredContent: { clear: true } })

    const turn: CopilotRealtimeTurnRequest = {
      assistantText: 'Done.',
      conversationId: 'realtime-test',
      source: 'transcribed',
      turnId: 'turn-1',
      userText: 'Lights on.'
    }
    await service.persistTurn(turn)
    await service.persistTurn(turn)
    expect((await conversations.snapshot('realtime-test'))?.messages).toHaveLength(2)
    expect(service.context()).toMatchObject({ updatedAt: null })
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('the PHOENIX HTTP API exposes the complete Realtime browser bridge', async () => {
  const realtime = new RecordingRealtimeService()
  const application = new PhoenixApplication({
    copilot: null,
    copilotRealtime: realtime,
    databasePath: ':memory:',
    eliteDirectory: null,
    host: '127.0.0.1',
    port: 0
  })
  const address = await application.start()
  const base = `http://${address.host}:${address.port}/api/copilot/realtime`

  try {
    await expect(fetch(`${base}/audio-processing`).then(response => response.json()))
      .resolves.toMatchObject({ audioProcessing: { enabled: true } })
    await expect(fetch(`${base}/context`).then(response => response.json()))
      .resolves.toEqual({ fingerprint: 'state-1', text: 'Fresh state.', updatedAt: null })
    await expect(post(`${base}/token`, { conversationId: 'phoenix-copilot' }))
      .resolves.toEqual({ value: 'token', model: 'realtime-test' })
    await expect(post(`${base}/tool`, { arguments: {}, name: 'phoenix_test' }))
      .resolves.toMatchObject({ result: { structuredContent: { ok: true } } })
    await post(`${base}/turn`, {
      assistantText: 'Done.',
      conversationId: 'phoenix-copilot',
      source: 'typed',
      turnId: 'typed-1',
      userText: 'Test.'
    })
    expect(realtime.turns).toHaveLength(1)
  } finally {
    await application.stop()
  }
})

class RecordingRealtimeGateway implements RealtimeClientSecretGateway {
  public session?: JsonObject

  public create (session: JsonObject): Promise<{ value: string, expiresAt: number }> {
    this.session = session
    return Promise.resolve({ value: 'ephemeral-test', expiresAt: 123 })
  }
}

class RecordingRealtimeService implements CopilotRealtime {
  public readonly turns: CopilotRealtimeTurnRequest[] = []

  public audioProcessing (): CopilotAudioProcessing { return audioProcessing }
  public context () { return { fingerprint: 'state-1', text: 'Fresh state.', updatedAt: null } }
  public createToken (_request: CopilotRealtimeTokenRequest) {
    return Promise.resolve({ value: 'token', model: 'realtime-test' })
  }
  public executeTool (_request: CopilotRealtimeToolRequest) {
    return Promise.resolve({ structuredContent: { ok: true } })
  }
  public persistTurn (request: CopilotRealtimeTurnRequest): Promise<void> {
    this.turns.push(request)
    return Promise.resolve()
  }
}

async function post (url: string, body: unknown): Promise<unknown> {
  const response = await fetch(url, {
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
    method: 'POST'
  })
  expect(response.status).toBe(200)
  return response.json() as Promise<unknown>
}
