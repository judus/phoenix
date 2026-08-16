import { PairingStatusSchema, RuntimeStateSchema } from '@phoenix/contracts'
import type { HealthResponse, PairingStatus, RuntimeState } from '@phoenix/contracts'
import type { PhoenixApi } from '../../application/api/phoenix-api.js'

export class PhoenixApiClient implements PhoenixApi {
  readonly #baseUrl: string
  readonly #request: typeof fetch

  constructor(baseUrl = '', request: typeof fetch = globalThis.fetch) {
    this.#baseUrl = baseUrl
    this.#request = request.bind(globalThis)
  }

  async getPairingStatus(signal?: AbortSignal): Promise<PairingStatus> {
    const response = await this.#request(`${this.#baseUrl}/api/pairing/status`, {
      credentials: 'same-origin',
      headers: { accept: 'application/json' },
      signal
    })
    if (!response.ok) throw await apiError(response)
    return PairingStatusSchema.parse(await response.json())
  }

  async claimPairing(code: string, signal?: AbortSignal): Promise<PairingStatus> {
    const response = await this.#request(`${this.#baseUrl}/api/pairing/claim`, {
      body: JSON.stringify({ code }),
      credentials: 'same-origin',
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      method: 'POST',
      signal
    })
    if (!response.ok) throw await apiError(response)
    return PairingStatusSchema.parse(await response.json())
  }

  async getHealth(signal?: AbortSignal): Promise<HealthResponse> {
    const response = await this.#request(`${this.#baseUrl}/api/health`, {
      credentials: 'same-origin',
      headers: { accept: 'application/json' },
      signal
    })
    if (!response.ok) throw await apiError(response)
    return response.json() as Promise<HealthResponse>
  }

  async getRuntimeState(signal?: AbortSignal): Promise<RuntimeState> {
    const response = await this.#request(`${this.#baseUrl}/api/runtime-state`, {
      credentials: 'same-origin',
      headers: { accept: 'application/json' },
      signal
    })
    if (!response.ok) throw await apiError(response)
    return RuntimeStateSchema.parse(await response.json())
  }

  eventStreamUrl(): string {
    return `${this.#baseUrl}/api/events?conversationId=phoenix-copilot`
  }
}

async function apiError(response: Response): Promise<Error> {
  try {
    const payload = await response.json() as { error?: { message?: unknown } }
    if (typeof payload.error?.message === 'string') return new Error(payload.error.message)
  } catch {
    // Fall back to status evidence when the server did not return the API error envelope.
  }
  return new Error(`PHOENIX API returned HTTP ${response.status}.`)
}
