import { z } from 'zod'

const SESSION_LIFETIME_MS = 365 * 24 * 60 * 60 * 1000
const FAILED_ATTEMPT_WINDOW_MS = 60_000

export const PairingStatusSchema = z.object({
  authenticated: z.boolean(),
  installationId: z.string().min(1),
  pairingRequired: z.boolean()
})

export type PairingStatus = z.infer<typeof PairingStatusSchema>

export interface PairingSession {
  createdAt: string
  expiresAt: string
  id: string
  tokenHash: string
}

export interface PairingCredentials {
  installationId: string
  pairingCode: string
  secret: string
  sessions: PairingSession[]
  version: 2
}

export interface PairingCredentialsRepository {
  load(): unknown | null
  save(credentials: PairingCredentials): void
}

export interface PairingSecurity {
  createId(): string
  createPairingCode(): string
  createSecret(): string
  createSessionToken(): string
  equals(left: string, right: string): boolean
  hash(secret: string, value: string): string
}

export interface PairingAccessEvidence {
  bearerToken?: string
  sessionToken?: string
}

export interface PairingAuthorization {
  id: string
  type: 'installation' | 'session'
}

export interface PairingServiceOptions {
  now?: () => number
}

export class PairingAttemptLimitError extends Error {}

export class PairingService {
  private readonly credentials: PairingCredentials
  private readonly failedAttempts: number[] = []
  private readonly now: () => number

  public constructor (
    private readonly repository: PairingCredentialsRepository,
    private readonly security: PairingSecurity,
    options: PairingServiceOptions = {}
  ) {
    this.now = options.now ?? Date.now
    const stored = repository.load()
    this.credentials = stored === null ? this.createCredentials() : parseCredentials(stored)
    if (stored === null) this.persist()
  }

  public get installationId (): string {
    return this.credentials.installationId
  }

  public get pairingCode (): string {
    return this.credentials.pairingCode
  }

  public get bearerToken (): string {
    return this.credentials.secret
  }

  public status (evidence: PairingAccessEvidence = {}): PairingStatus {
    return {
      authenticated: this.authorize(evidence) !== null,
      installationId: this.installationId,
      pairingRequired: true
    }
  }

  public claim (candidate: string): string | null {
    const now = this.now()
    this.discardOldFailures(now)
    if (this.failedAttempts.length >= 10) {
      throw new PairingAttemptLimitError('Too many pairing attempts. Try again in one minute.')
    }
    if (!this.security.equals(normalizeCode(candidate), normalizeCode(this.credentials.pairingCode))) {
      this.failedAttempts.push(now)
      return null
    }
    this.failedAttempts.length = 0
    return this.createSession(now)
  }

  public isAuthorized (evidence: PairingAccessEvidence): boolean {
    return this.authorize(evidence) !== null
  }

  public authorize (evidence: PairingAccessEvidence): PairingAuthorization | null {
    if (evidence.bearerToken !== undefined &&
        this.security.equals(evidence.bearerToken, this.credentials.secret)) {
      return { id: this.credentials.installationId, type: 'installation' }
    }
    if (evidence.sessionToken === undefined) return null
    const now = this.now()
    this.pruneExpiredSessions(now)
    const tokenHash = this.security.hash(this.credentials.secret, evidence.sessionToken)
    const session = this.credentials.sessions.find(candidate => this.security.equals(candidate.tokenHash, tokenHash))
    return session ? { id: session.id, type: 'session' } : null
  }

  public release (sessionToken: string | undefined): boolean {
    if (!sessionToken) return false
    const tokenHash = this.security.hash(this.credentials.secret, sessionToken)
    const retained = this.credentials.sessions.filter(session => !this.security.equals(session.tokenHash, tokenHash))
    if (retained.length === this.credentials.sessions.length) return false
    this.credentials.sessions = retained
    this.persist()
    return true
  }

  private createCredentials (): PairingCredentials {
    return {
      installationId: this.security.createId(),
      pairingCode: this.security.createPairingCode(),
      secret: this.security.createSecret(),
      sessions: [],
      version: 2
    }
  }

  private createSession (now: number): string {
    this.pruneExpiredSessions(now)
    const token = this.security.createSessionToken()
    this.credentials.sessions.push({
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + SESSION_LIFETIME_MS).toISOString(),
      id: this.security.createId(),
      tokenHash: this.security.hash(this.credentials.secret, token)
    })
    this.credentials.sessions = this.credentials.sessions.slice(-64)
    this.persist()
    return token
  }

  private discardOldFailures (now: number): void {
    while (this.failedAttempts[0] !== undefined &&
           this.failedAttempts[0] < now - FAILED_ATTEMPT_WINDOW_MS) this.failedAttempts.shift()
  }

  private pruneExpiredSessions (now: number): void {
    const retained = this.credentials.sessions.filter(session => Date.parse(session.expiresAt) > now)
    if (retained.length === this.credentials.sessions.length) return
    this.credentials.sessions = retained
    this.persist()
  }

  private persist (): void {
    this.repository.save(this.credentials)
  }
}

function parseCredentials (candidate: unknown): PairingCredentials {
  if (!isRecord(candidate) || ![1, 2].includes(candidate.version as number) ||
      typeof candidate.installationId !== 'string' || typeof candidate.pairingCode !== 'string' ||
      typeof candidate.secret !== 'string' || candidate.secret.length < 32) {
    throw new Error('Control Deck pairing credentials are invalid.')
  }
  return {
    installationId: candidate.installationId,
    pairingCode: candidate.pairingCode,
    secret: candidate.secret,
    sessions: candidate.version === 2 && Array.isArray(candidate.sessions)
      ? candidate.sessions.map(parseSession)
      : [],
    version: 2
  }
}

function parseSession (candidate: unknown): PairingSession {
  if (!isRecord(candidate) || typeof candidate.id !== 'string' ||
      typeof candidate.tokenHash !== 'string' || typeof candidate.createdAt !== 'string' ||
      typeof candidate.expiresAt !== 'string' || !Number.isFinite(Date.parse(candidate.createdAt)) ||
      !Number.isFinite(Date.parse(candidate.expiresAt))) {
    throw new Error('Control Deck pairing credentials contain an invalid browser session.')
  }
  return candidate as unknown as PairingSession
}

function normalizeCode (value: string): string {
  return value.trim().toUpperCase().replaceAll(/[^A-Z0-9]/gu, '')
}

function isRecord (value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
