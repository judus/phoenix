import {
  GameActionCatalogResponseSchema,
  GameActionResultSchema,
  EliteStatusSourceDiagnosticsSchema,
  RuntimeStateSchema,
  type GameActionCatalogResponse,
  type GameActionResult,
  type EliteStatusSourceDiagnostics,
  type HealthResponse,
  type RuntimeState
} from '@phoenix/contracts'

export interface PhoenixApi {
  executeDeveloperAction(actionId: string): Promise<GameActionResult>
  getEliteStatusDiagnostics(): Promise<EliteStatusSourceDiagnostics>
  getDeveloperActions(): Promise<GameActionCatalogResponse>
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

  public async getDeveloperActions (): Promise<GameActionCatalogResponse> {
    const response = await this.request(`${this.baseUrl}/api/developer/actions`, {
      headers: { accept: 'application/json' }
    })
    if (!response.ok) throw new Error(`PHOENIX API returned HTTP ${response.status}.`)
    return GameActionCatalogResponseSchema.parse(await response.json())
  }

  public async executeDeveloperAction (actionId: string): Promise<GameActionResult> {
    const response = await this.request(`${this.baseUrl}/api/developer/actions/execute`, {
      body: JSON.stringify({ actionId, operation: 'tap' }),
      headers: {
        accept: 'application/json',
        'content-type': 'application/json'
      },
      method: 'POST'
    })
    if (!response.ok) throw new Error(`PHOENIX API returned HTTP ${response.status}.`)
    return GameActionResultSchema.parse(await response.json())
  }

  public async getEliteStatusDiagnostics (): Promise<EliteStatusSourceDiagnostics> {
    const response = await this.request(`${this.baseUrl}/api/developer/elite-status`, {
      headers: { accept: 'application/json' }
    })
    if (!response.ok) throw new Error(`PHOENIX API returned HTTP ${response.status}.`)
    return EliteStatusSourceDiagnosticsSchema.parse(await response.json())
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
