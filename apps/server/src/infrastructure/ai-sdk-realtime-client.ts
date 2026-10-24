import { createOpenAI } from '@ai-sdk/openai'
import type { JsonObject } from '@jdu/llm-client'
import type { RealtimeClientSecretGateway } from '../application/copilot-realtime-service.js'
import type { OpenAiRealtimeClientOptions } from './openai-realtime-client.js'

/** Token creation only. PHOENIX retains browser audio/session and local-tool ownership. */
export class AiSdkRealtimeClient implements RealtimeClientSecretGateway {
  public constructor (private readonly options: OpenAiRealtimeClientOptions) {}

  public async create (request: JsonObject): Promise<{ value: string, expiresAt?: number }> {
    const session = request.session
    if (!isObject(session) || typeof session.model !== 'string') {
      throw new Error('Realtime session requires a model and an object configuration.')
    }
    this.options.wireLogger?.({ operation: 'realtime.token', provider: 'openai', backend: 'ai-sdk',
      type: 'request', request: { body: request } })
    try {
      const provider = createOpenAI({ apiKey: this.options.apiKey, fetch: this.options.request,
        ...(this.options.safetyIdentifier ? { headers: { 'openai-safety-identifier': this.options.safetyIdentifier } } : {}) })
      const secret = await provider.experimental_realtime.getToken({ model: session.model, api: 'realtime',
        // Supported provider overrides preserve PHOENIX's native VAD/turn-control fields,
        // which the generic experimental realtime mapper does not express completely.
        sessionConfig: { providerOptions: session } })
      if (typeof secret.token !== 'string' || !secret.token) throw new Error('Missing realtime token.')
      this.options.wireLogger?.({ operation: 'realtime.token', provider: 'openai', backend: 'ai-sdk',
        type: 'response', response: { body: { value: '[REDACTED]', expires_at: secret.expiresAt } } })
      return { value: secret.token, ...(secret.expiresAt === undefined ? {} : { expiresAt: secret.expiresAt }) }
    } catch {
      // Provider errors may include raw upstream bodies. Never return them with credentials.
      throw new Error('AI SDK could not create the OpenAI realtime session. No other backend was attempted.')
    }
  }
}

function isObject (value: unknown): value is JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
