export type EddnSchema = 'journal' | 'commodity' | 'outfitting' | 'shipyard'
export type EddnMode = 'unavailable' | 'test'

// Live publishing requires a reviewed release change, not an environment switch.
export function eddnMode (testMode: string | undefined): EddnMode {
  return testMode === '1' ? 'test' : 'unavailable'
}

export const EDDN_SCHEMA_VERSIONS = { journal: 1, commodity: 3, outfitting: 2, shipyard: 2 } as const
export const EDDN_MAX_AGE_MS = 24 * 60 * 60 * 1000
export const EDDN_MAX_MESSAGE_BYTES = 128 * 1024

export interface EddnMessage {
  $schemaRef: string
  header: {
    uploaderID: string
    softwareName: 'PHOENIX'
    softwareVersion: string
    gameversion: string
    gamebuild: string
  }
  message: Record<string, unknown>
}

export interface EddnPendingMessage {
  id: string
  message: EddnMessage
  attempts: number
}

export interface EddnOutbox {
  enqueue(id: string, message: EddnMessage, now: number): boolean
  next(now: number): EddnPendingMessage | undefined
  acknowledge(id: string, now: number): void
  discard(id: string): void
  retry(id: string, nextAttempt: number): void
  clear(): void
  prune(now: number): void
  status(): { queued: number, lastSuccessAt: string | null }
}

export interface EddnTransport {
  send(message: EddnMessage, signal: AbortSignal): Promise<{ status: number }>
}
