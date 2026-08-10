import {
  CatalogueDiagnosticsSchema,
  ControlGridLayoutSchema,
  CopilotChatRequestSchema,
  CopilotHistoryResponseSchema,
  GameActionCatalogResponseSchema,
  GameActionResultSchema,
  EliteJournalSourceDiagnosticsSchema,
  EliteStatusSourceDiagnosticsSchema,
  RuntimeStateSchema,
  type GameActionCatalogResponse,
  type CatalogueDiagnostics,
  type ControlGridLayout,
  type CopilotChatRequest,
  type CopilotHistoryResponse,
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
  getCopilotHistory(conversationId: string): Promise<CopilotHistoryResponse>
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
  streamCopilotMessage(
    input: CopilotChatRequest,
    onEvent: (event: CopilotStreamEvent) => void,
    signal?: AbortSignal
  ): Promise<void>
}

export type CopilotStreamEvent =
  | { type: 'started', conversationId: string }
  | { type: 'retrying', attempt: number }
  | { type: 'reset' }
  | { type: 'delta', delta: string }
  | { type: 'tool', callId: string, name?: string, status: string }
  | { type: 'completed', conversationId: string, text: string }

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

  public async getCopilotHistory (conversationId: string): Promise<CopilotHistoryResponse> {
    const response = await this.request(
      `${this.baseUrl}/api/copilot/conversations/${encodeURIComponent(conversationId)}`,
      { headers: { accept: 'application/json' } }
    )
    if (!response.ok) throw await apiError(response)
    return CopilotHistoryResponseSchema.parse(await response.json())
  }

  public async streamCopilotMessage (
    input: CopilotChatRequest,
    onEvent: (event: CopilotStreamEvent) => void,
    signal?: AbortSignal
  ): Promise<void> {
    const response = await this.request(`${this.baseUrl}/api/copilot/chat`, {
      body: JSON.stringify(CopilotChatRequestSchema.parse(input)),
      headers: {
        accept: 'text/event-stream',
        'content-type': 'application/json'
      },
      method: 'POST',
      ...(signal === undefined ? {} : { signal })
    })
    if (!response.ok) throw await apiError(response)
    if (!response.body) throw new Error('PHOENIX Copilot stream has no response body.')

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffered = ''
    while (true) {
      const result = await reader.read()
      buffered += decoder.decode(result.value, { stream: !result.done })
      let boundary = buffered.indexOf('\n\n')
      while (boundary >= 0) {
        const frame = buffered.slice(0, boundary)
        buffered = buffered.slice(boundary + 2)
        const event = parseCopilotStreamFrame(frame)
        if (event) onEvent(event)
        boundary = buffered.indexOf('\n\n')
      }
      if (result.done) break
    }
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

async function apiError (response: Response): Promise<Error> {
  try {
    const payload = await response.json() as { error?: { message?: unknown } }
    if (typeof payload.error?.message === 'string') return new Error(payload.error.message)
  } catch {}
  return new Error(`PHOENIX API returned HTTP ${response.status}.`)
}

function parseCopilotStreamFrame (frame: string): CopilotStreamEvent | undefined {
  if (!frame || frame.startsWith(':')) return undefined
  const lines = frame.split('\n')
  const type = lines.find(line => line.startsWith('event: '))?.slice(7)
  const serialized = lines.filter(line => line.startsWith('data: ')).map(line => line.slice(6)).join('\n')
  if (!type || !serialized) return undefined
  const payload = JSON.parse(serialized) as unknown
  if (!isRecord(payload)) throw new Error(`Invalid PHOENIX Copilot ${type} event.`)
  switch (type) {
    case 'started': return { type, conversationId: stringField(payload, 'conversationId') }
    case 'retrying': return { type, attempt: numberField(payload, 'attempt') }
    case 'reset': return { type }
    case 'delta': return { type, delta: stringField(payload, 'delta') }
    case 'tool': {
      const name = payload.name === undefined ? undefined : stringField(payload, 'name')
      return {
        type,
        callId: stringField(payload, 'callId'),
        ...(name === undefined ? {} : { name }),
        status: stringField(payload, 'status')
      }
    }
    case 'completed': return {
      type,
      conversationId: stringField(payload, 'conversationId'),
      text: stringField(payload, 'text')
    }
    case 'error': {
      const error = isRecord(payload.error) ? payload.error : {}
      throw new Error(typeof error.message === 'string' ? error.message : 'Copilot stream failed.')
    }
    default: return undefined
  }
}

function isRecord (candidate: unknown): candidate is Record<string, unknown> {
  return typeof candidate === 'object' && candidate !== null && !Array.isArray(candidate)
}

function stringField (record: Record<string, unknown>, key: string): string {
  const value = record[key]
  if (typeof value !== 'string') throw new Error(`Copilot event field ${key} must be a string.`)
  return value
}

function numberField (record: Record<string, unknown>, key: string): number {
  const value = record[key]
  if (typeof value !== 'number') throw new Error(`Copilot event field ${key} must be a number.`)
  return value
}
