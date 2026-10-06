import type { EddnStatus, EddnSubmission, EddnSubmissionDetail } from '@phoenix/contracts'

export type EddnSchema = keyof typeof EDDN_SCHEMA_VERSIONS
export type EddnMode = 'unavailable' | 'test'

// Live publishing requires a reviewed release change, not an environment switch.
export function eddnMode (testMode: string | undefined): EddnMode {
  return testMode === '1' ? 'test' : 'unavailable'
}

export const EDDN_SCHEMA_VERSIONS = {
  journal: 1, commodity: 3, outfitting: 2, shipyard: 2,
  fssdiscoveryscan: 1, navbeaconscan: 1, codexentry: 1, scanbarycentre: 1,
  navroute: 1, fcmaterials_journal: 1, approachsettlement: 1,
  fssallbodiesfound: 1, fssbodysignals: 1, fsssignaldiscovered: 1,
  dockingdenied: 1, dockinggranted: 1
} as const
export const EDDN_MAX_AGE_MS = 24 * 60 * 60 * 1000
// Long plotted routes and busy-system signal batches routinely exceed the initial 128 KiB cap.
export const EDDN_MAX_MESSAGE_BYTES = 2 * 1024 * 1024
export const EDDN_REQUEST_TIMEOUT_MS = 15_000

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
  message: unknown
  attempts: number
}

export interface EddnOutbox {
  enqueue(id: string, message: EddnMessage, now: number): boolean
  next(now: number): EddnPendingMessage | undefined
  acknowledge(id: string, now: number): void
  drop(id: string, reason: 'expired' | 'invalid' | 'rejected', now: number): void
  beginAttempt(id: string, retryAt: number, now: number): number
  finishAttempt(id: number, outcome: Exclude<EddnSubmission['outcome'], 'sending'>, httpStatus: number | null, now: number, retryAt?: number): void
  submissions(now: number): EddnSubmission[]
  submission(id: number, now: number): EddnSubmissionDetail | undefined
  retry(id: string, nextAttempt: number): void
  clear(now: number): void
  prune(now: number): void
  status(): Pick<EddnStatus, 'queued' | 'lastSuccessAt' | 'losses'>
}

export class EddnQueueCapacityError extends Error {
  public constructor () { super('Contribution storage is at capacity. This observation was skipped; queued observations will still retry.') }
}

export interface EddnTransport {
  send(message: EddnMessage, signal: AbortSignal): Promise<{ status: number }>
}
