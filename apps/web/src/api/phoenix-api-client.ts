import {
  CatalogueDiagnosticsSchema,
  ControlGridLayoutSchema,
  GameActionCatalogResponseSchema,
  GameActionResultSchema,
  EliteJournalSourceDiagnosticsSchema,
  EliteStatusSourceDiagnosticsSchema,
  RuntimeStateSchema,
  type GameActionCatalogResponse,
  type CatalogueDiagnostics,
  type ControlGridLayout,
  type GameActionResult,
  type GameActionOperation,
  type EliteJournalSourceDiagnostics,
  type EliteStatusSourceDiagnostics,
  type HealthResponse,
  type RuntimeState
} from '@phoenix/contracts'

export interface PhoenixApi {
  getCatalogueDiagnostics(): Promise<CatalogueDiagnostics>
  getControlLayout(): Promise<ControlGridLayout>
  executeDeveloperAction(actionId: string): Promise<GameActionResult>
  executeAction(actionId: string, operation?: GameActionOperation): Promise<GameActionResult>
  getEliteJournalDiagnostics(): Promise<EliteJournalSourceDiagnostics>
  getEliteStatusDiagnostics(): Promise<EliteStatusSourceDiagnostics>
  getActions(): Promise<GameActionCatalogResponse>
  getDeveloperActions(): Promise<GameActionCatalogResponse>
  getHealth(): Promise<HealthResponse>
  getRuntimeState(): Promise<RuntimeState>
  saveControlLayout(layout: ControlGridLayout): Promise<ControlGridLayout>
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

  public async getActions (): Promise<GameActionCatalogResponse> {
    const response = await this.request(`${this.baseUrl}/api/actions`, {
      headers: { accept: 'application/json' }
    })
    if (!response.ok) throw new Error(`PHOENIX API returned HTTP ${response.status}.`)
    return GameActionCatalogResponseSchema.parse(await response.json())
  }

  public async getDeveloperActions (): Promise<GameActionCatalogResponse> {
    return this.getActions()
  }

  public async getCatalogueDiagnostics (): Promise<CatalogueDiagnostics> {
    const response = await this.request(`${this.baseUrl}/api/developer/catalogue`, {
      headers: { accept: 'application/json' }
    })
    if (!response.ok) throw new Error(`PHOENIX API returned HTTP ${response.status}.`)
    return CatalogueDiagnosticsSchema.parse(await response.json())
  }

  public async getControlLayout (): Promise<ControlGridLayout> {
    const response = await this.request(`${this.baseUrl}/api/control-layout`, {
      headers: { accept: 'application/json' }
    })
    if (!response.ok) throw new Error(`PHOENIX API returned HTTP ${response.status}.`)
    return ControlGridLayoutSchema.parse(await response.json())
  }

  public async saveControlLayout (layout: ControlGridLayout): Promise<ControlGridLayout> {
    const response = await this.request(`${this.baseUrl}/api/control-layout`, {
      body: JSON.stringify(layout),
      headers: {
        accept: 'application/json',
        'content-type': 'application/json'
      },
      method: 'PUT'
    })
    if (!response.ok) throw new Error(`PHOENIX API returned HTTP ${response.status}.`)
    return ControlGridLayoutSchema.parse(await response.json())
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

  public async executeAction (
    actionId: string,
    operation: GameActionOperation = 'tap'
  ): Promise<GameActionResult> {
    const response = await this.request(`${this.baseUrl}/api/actions/execute`, {
      body: JSON.stringify({ actionId, operation }),
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

  public async getEliteJournalDiagnostics (): Promise<EliteJournalSourceDiagnostics> {
    const response = await this.request(`${this.baseUrl}/api/developer/elite-journal`, {
      headers: { accept: 'application/json' }
    })
    if (!response.ok) throw new Error(`PHOENIX API returned HTTP ${response.status}.`)
    return EliteJournalSourceDiagnosticsSchema.parse(await response.json())
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
