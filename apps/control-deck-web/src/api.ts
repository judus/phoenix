import {
  ControlDeckCommandCatalogueSchema,
  ControlDeckCommandExecutionResultSchema,
  ControlDeckConfigurationSchema,
  PairingStatusSchema,
  type ControlDeckCommandOperation,
  type ControlDeckCommandTarget,
  type ControlDeckConfiguration
} from '@jdu/control-deck-core'

export class ControlDeckApi {
  public status () { return this.get('/api/pairing/status', PairingStatusSchema) }

  public claim (code: string) {
    return this.request('/api/pairing/claim', { method: 'POST', body: JSON.stringify({ code }) }, PairingStatusSchema)
  }

  public configuration () { return this.get('/api/configuration', ControlDeckConfigurationSchema) }

  public saveConfiguration (configuration: ControlDeckConfiguration) {
    return this.request('/api/configuration', { method: 'PUT', body: JSON.stringify(configuration) }, ControlDeckConfigurationSchema)
  }

  public commands () { return this.get('/api/commands', ControlDeckCommandCatalogueSchema) }

  public execute (target: ControlDeckCommandTarget, operation: ControlDeckCommandOperation, leaseId?: string) {
    return this.request('/api/commands/execute', {
      method: 'POST',
      body: JSON.stringify({ target, operation, ...(leaseId ? { leaseId } : {}) })
    }, ControlDeckCommandExecutionResultSchema)
  }

  private get<T> (path: string, schema: { parse(value: unknown): T }) {
    return this.request(path, {}, schema)
  }

  private async request<T> (path: string, init: RequestInit, schema: { parse(value: unknown): T }): Promise<T> {
    const response = await fetch(path, {
      ...init,
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json', ...init.headers }
    })
    const body: unknown = await response.json()
    if (!response.ok) {
      const message = isRecord(body) && isRecord(body.error) && typeof body.error.message === 'string'
        ? body.error.message
        : `Control Deck request failed (${response.status}).`
      throw new Error(message)
    }
    return schema.parse(body)
  }
}

function isRecord (value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
