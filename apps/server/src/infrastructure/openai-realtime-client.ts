import type { JsonObject } from '@maduser/ai-ts'
import type { RealtimeClientSecretGateway } from '../application/copilot-realtime-service.js'

export interface OpenAiRealtimeClientOptions {
  apiKey: string
  request?: typeof fetch
  safetyIdentifier?: string
  wireLogger?: (event: unknown) => void
}

export class OpenAiRealtimeClient implements RealtimeClientSecretGateway {
  private readonly request: typeof fetch

  public constructor (private readonly options: OpenAiRealtimeClientOptions) {
    this.request = (options.request ?? globalThis.fetch).bind(globalThis)
  }

  public async create (session: JsonObject): Promise<{ value: string, expiresAt?: number }> {
    const body = JSON.stringify(session)
    this.options.wireLogger?.({
      operation: 'realtime.token',
      provider: 'openai',
      request: { body: session, method: 'POST', url: 'https://api.openai.com/v1/realtime/client_secrets' },
      type: 'request'
    })
    const response = await this.request('https://api.openai.com/v1/realtime/client_secrets', {
      body,
      headers: {
        authorization: `Bearer ${this.options.apiKey}`,
        'content-type': 'application/json',
        ...(this.options.safetyIdentifier === undefined
          ? {}
          : { 'openai-safety-identifier': this.options.safetyIdentifier })
      },
      method: 'POST'
    })
    const text = await response.text()
    let payload: unknown
    try { payload = JSON.parse(text) as unknown } catch { payload = undefined }
    this.options.wireLogger?.({
      operation: 'realtime.token',
      provider: 'openai',
      response: {
        body: redactSecret(payload ?? text),
        headers: Object.fromEntries(response.headers),
        status: response.status
      },
      type: 'response'
    })
    if (!response.ok || !isRecord(payload) || typeof payload.value !== 'string') {
      throw new Error(`OpenAI Realtime token creation failed (${response.status}).`)
    }
    return {
      value: payload.value,
      ...(typeof payload.expires_at === 'number' ? { expiresAt: payload.expires_at } : {})
    }
  }
}

function redactSecret (payload: unknown): unknown {
  return isRecord(payload) && typeof payload.value === 'string'
    ? { ...payload, value: '[REDACTED]' }
    : payload
}

function isRecord (candidate: unknown): candidate is Record<string, unknown> {
  return typeof candidate === 'object' && candidate !== null && !Array.isArray(candidate)
}
