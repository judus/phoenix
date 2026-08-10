import {
  PHOENIX_API_VERSION,
  type HealthResponse
} from '@phoenix/contracts'
import type { Database } from '../domain/database.js'

export interface HealthCheck {
  getHealth(): HealthResponse
}

export class HealthService implements HealthCheck {
  public constructor (private readonly database: Database) {}

  public getHealth (): HealthResponse {
    return {
      apiVersion: PHOENIX_API_VERSION,
      database: this.database.health(),
      name: 'PHOENIX',
      status: 'ok',
      timestamp: new Date().toISOString()
    }
  }
}

