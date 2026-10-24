import { expect, test } from 'vitest'
import { AiSdkRealtimeClient } from '../apps/server/src/infrastructure/ai-sdk-realtime-client.js'
import { OpenAiRealtimeClient } from '../apps/server/src/infrastructure/openai-realtime-client.js'
import type { JsonObject } from '@jdu/llm-client'

const session: JsonObject = { session: {
  type: 'realtime', model: 'fixture-realtime', instructions: 'Stay in character.', output_modalities: ['audio'], tool_choice: 'auto',
  audio: { input: { format: { type: 'audio/pcm', rate: 24000 }, transcription: { model: 'fixture-transcribe' },
    turn_detection: { type: 'semantic_vad', create_response: false, interrupt_response: true, eagerness: 'medium' } },
  output: { voice: 'marin', format: { type: 'audio/pcm', rate: 24000 } } },
  tools: [{ type: 'function', name: 'phoenix_ship_status', description: 'Read ship', parameters: { type: 'object', properties: {} } }]
} }

test('SDK realtime token gateway preserves the existing native session exactly', async () => {
  const bodies: unknown[] = []
  const logs: unknown[] = []
  const request: typeof fetch = async (url, init) => {
    expect(String(url)).toBe('https://api.openai.com/v1/realtime/client_secrets')
    bodies.push(JSON.parse(String(init?.body)))
    return new Response(JSON.stringify({ value: 'synthetic-ephemeral-token', expires_at: 123 }), { headers: { 'content-type': 'application/json' } })
  }
  const options = { apiKey: 'synthetic-private-key', request, wireLogger: (event: unknown) => { logs.push(event) } }
  const native = await new OpenAiRealtimeClient(options).create(session)
  const sdk = await new AiSdkRealtimeClient(options).create(session)
  expect(sdk).toEqual(native)
  expect(bodies).toEqual([session, session])
  expect(JSON.stringify(logs)).not.toContain('synthetic-ephemeral-token')
  expect(JSON.stringify(logs)).not.toContain('synthetic-private-key')
})

test('SDK realtime error is redacted and is not retried on another backend', async () => {
  let requests = 0
  const client = new AiSdkRealtimeClient({ apiKey: 'synthetic-private-key', request: async () => {
    requests++
    return new Response('private provider error', { status: 401 })
  } })
  await expect(client.create(session)).rejects.toThrow('No other backend was attempted')
  expect(requests).toBe(1)
})

test('SDK realtime rejects a malformed token instead of reporting a working session', async () => {
  const client = new AiSdkRealtimeClient({ apiKey: 'synthetic-private-key', request: async () =>
    new Response('{}', { headers: { 'content-type': 'application/json' } }) })
  await expect(client.create(session)).rejects.toThrow('could not create')
})
