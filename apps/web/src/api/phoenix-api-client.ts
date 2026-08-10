import {
  RuntimeStateSchema,
  type HealthResponse,
  type RuntimeState
} from '@phoenix/contracts'

export interface PhoenixApi {
  getHealth(): Promise<HealthResponse>
  getRuntimeState(): Promise<RuntimeState>
  runtimeStateStreamUrl(): string
}

export class PhoenixApiClient implements PhoenixApi {
  private readonly request: typeof fetch

  public constructor (
    private readonly baseUrl = '',
    request: typeof fetch = globalThis.fetch
  ) {
    this.request = request.bind(globalThis)
  }

  public async getHealth (): Promise<HealthResponse> {
    const response = await this.request(`${this.baseUrl}/api/health`, {
      headers: { accept: 'application/json' }
    })
    if (!response.ok) throw new Error(`PHOENIX API returned HTTP ${response.status}.`)
    return response.json() as Promise<HealthResponse>
  }

  public async getRuntimeState (): Promise<RuntimeState> {
    const response = await this.request(`${this.baseUrl}/api/runtime-state`, {
      headers: { accept: 'application/json' }
    })
    if (!response.ok) throw new Error(`PHOENIX API returned HTTP ${response.status}.`)
    return RuntimeStateSchema.parse(await response.json())
  }

  public runtimeStateStreamUrl (): string {
    return `${this.baseUrl}/api/runtime-state/stream`
  }
}
