import type { DatabaseHealth } from '@phoenix/contracts'

export interface Database {
  close(): void
  health(): DatabaseHealth
  initialize(): void
}

