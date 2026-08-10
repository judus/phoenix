export * from './actions.js'
export * from './elite-status.js'
export * from './runtime.js'

export const PHOENIX_API_VERSION = '1' as const

export interface DatabaseHealth {
  connected: boolean
  engine: 'sqlite'
}

export interface HealthResponse {
  apiVersion: typeof PHOENIX_API_VERSION
  database: DatabaseHealth
  name: 'PHOENIX'
  status: 'ok'
  timestamp: string
}
