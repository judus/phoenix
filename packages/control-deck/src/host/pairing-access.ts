import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'

export interface PairingRequest {
  headers: { authorization?: string, cookie?: string }
}

export interface PairingStatus {
  authenticated: boolean
  installationId: string
  pairingRequired: boolean
}

export interface BrowserSession {
  createdAt: string
  expiresAt: string
  id: string
  name?: string
  tokenHash: string
}

export interface PairingCredentials {
  installationId: string
  pairingCode: string
  secret: string
  sessions: BrowserSession[]
  version: 2
}

export interface PairingCredentialStore {
  load(): unknown | undefined
  save(credentials: PairingCredentials): void
}

export interface PairingAccessOptions {
  challengeLifetimeMs?: number
  cookieName?: string
  maximumFailedAttempts?: number
  sessionLifetimeMs?: number
  now?: () => number
}

export interface PairingChallenge {
  challenge: string
  expiresAt: string
  pairingUrl: string
}

export type PairingSessionInfo = Omit<BrowserSession, 'tokenHash'>

export class PairingAttemptLimitError extends Error {}

export class PairingAccessController {
  private readonly credentials: PairingCredentials
  private readonly challenges = new Map<string, number>()
  private readonly failedAttempts: number[] = []
  private readonly cookieName: string
  private readonly maximumFailedAttempts: number
  private readonly sessionLifetimeMs: number
  private readonly challengeLifetimeMs: number
  private readonly now: () => number

  public constructor (
    private readonly store: PairingCredentialStore,
    options: PairingAccessOptions = {}
  ) {
    this.cookieName = options.cookieName ?? 'control_deck_session'
    this.challengeLifetimeMs = options.challengeLifetimeMs ?? 2 * 60 * 1000
    this.maximumFailedAttempts = options.maximumFailedAttempts ?? 10
    this.sessionLifetimeMs = options.sessionLifetimeMs ?? 365 * 24 * 60 * 60 * 1000
    this.now = options.now ?? Date.now
    const candidate = store.load()
    this.credentials = candidate === undefined ? createCredentials() : parseCredentials(candidate)
    if (candidate === undefined) store.save(this.credentials)
  }

  public get installationId (): string { return this.credentials.installationId }
  public get pairingCode (): string { return this.credentials.pairingCode }
  public get bearerToken (): string { return this.credentials.secret }

  public status (request: PairingRequest): PairingStatus {
    return { authenticated: this.isAuthorized(request), installationId: this.installationId, pairingRequired: true }
  }

  public claim (candidate: string, deviceName?: string): string | null {
    const now = this.now()
    while (this.failedAttempts[0] !== undefined && this.failedAttempts[0] < now - 60_000) this.failedAttempts.shift()
    if (this.failedAttempts.length >= this.maximumFailedAttempts) throw new PairingAttemptLimitError('Too many pairing attempts. Try again in one minute.')
    if (!this.consumeChallenge(candidate, now) && !safeEqual(normalizeCode(candidate), normalizeCode(this.credentials.pairingCode))) {
      this.failedAttempts.push(now)
      return null
    }
    this.failedAttempts.length = 0
    return this.createBrowserSession(now, deviceName)
  }

  public createPairingChallenge (gatewayUrl: string): PairingChallenge {
    const url = new URL(gatewayUrl)
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('The Control Deck gateway URL must use HTTP or HTTPS.')
    const now = this.now()
    this.pruneChallenges(now)
    const challenge = `cdp_${randomBytes(24).toString('base64url')}`
    const expiresAt = now + this.challengeLifetimeMs
    this.challenges.set(hashChallenge(challenge), expiresAt)
    url.searchParams.set('pairingChallenge', challenge)
    return { challenge, expiresAt: new Date(expiresAt).toISOString(), pairingUrl: url.toString() }
  }

  public listSessions (): PairingSessionInfo[] {
    this.pruneExpiredSessions(this.now())
    return this.credentials.sessions.map(({ tokenHash: _tokenHash, ...session }) => session)
  }

  public revokeSession (sessionId: string): boolean {
    const retained = this.credentials.sessions.filter(session => session.id !== sessionId)
    if (retained.length === this.credentials.sessions.length) return false
    this.credentials.sessions = retained
    this.store.save(this.credentials)
    return true
  }

  public isAuthorized (request: PairingRequest): boolean {
    const authorization = request.headers.authorization
    if (authorization?.startsWith('Bearer ')) return safeEqual(authorization.slice('Bearer '.length).trim(), this.credentials.secret)
    const session = parseCookies(request.headers.cookie)[this.cookieName]
    if (session === undefined) return false
    const now = this.now()
    this.pruneExpiredSessions(now)
    const tokenHash = this.browserSessionTokenHash(session)
    return this.credentials.sessions.some(candidate => safeEqual(candidate.tokenHash, tokenHash))
  }

  public sessionCookie (token: string): string {
    return `${this.cookieName}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${Math.floor(this.sessionLifetimeMs / 1000)}`
  }

  public clearSessionCookie (): string {
    return `${this.cookieName}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`
  }

  public release (request: PairingRequest): boolean {
    const token = parseCookies(request.headers.cookie)[this.cookieName]
    if (!token) return false
    const tokenHash = this.browserSessionTokenHash(token)
    const retained = this.credentials.sessions.filter(session => !safeEqual(session.tokenHash, tokenHash))
    if (retained.length === this.credentials.sessions.length) return false
    this.credentials.sessions = retained
    this.store.save(this.credentials)
    return true
  }

  private createBrowserSession (now: number, deviceName?: string): string {
    this.pruneExpiredSessions(now)
    const token = randomBytes(32).toString('base64url')
    this.credentials.sessions.push({
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + this.sessionLifetimeMs).toISOString(),
      id: randomUUID(),
      ...(deviceName?.trim() ? { name: deviceName.trim().slice(0, 80) } : {}),
      tokenHash: this.browserSessionTokenHash(token)
    })
    this.credentials.sessions = this.credentials.sessions.slice(-64)
    this.store.save(this.credentials)
    return token
  }

  private browserSessionTokenHash (token: string): string {
    return createHmac('sha256', this.credentials.secret).update(token).digest('base64url')
  }

  private pruneExpiredSessions (now: number): void {
    const retained = this.credentials.sessions.filter(session => Date.parse(session.expiresAt) > now)
    if (retained.length === this.credentials.sessions.length) return
    this.credentials.sessions = retained
    this.store.save(this.credentials)
  }

  private consumeChallenge (challenge: string, now: number): boolean {
    if (!challenge.startsWith('cdp_')) return false
    this.pruneChallenges(now)
    const key = hashChallenge(challenge)
    const expiresAt = this.challenges.get(key)
    if (expiresAt === undefined || expiresAt <= now) return false
    this.challenges.delete(key)
    return true
  }

  private pruneChallenges (now: number): void {
    for (const [key, expiresAt] of this.challenges) if (expiresAt <= now) this.challenges.delete(key)
  }
}

function createCredentials (): PairingCredentials {
  return { installationId: randomUUID(), pairingCode: readableCode(), secret: randomBytes(32).toString('base64url'), sessions: [], version: 2 }
}

function parseCredentials (candidate: unknown): PairingCredentials {
  if (!isRecord(candidate) || ![1, 2].includes(candidate.version as number) || typeof candidate.installationId !== 'string' ||
      typeof candidate.pairingCode !== 'string' || typeof candidate.secret !== 'string' || candidate.secret.length < 32) {
    throw new Error('Control Deck pairing credentials are invalid.')
  }
  return {
    installationId: candidate.installationId,
    pairingCode: candidate.pairingCode,
    secret: candidate.secret,
    sessions: candidate.version === 2 && Array.isArray(candidate.sessions) ? candidate.sessions.map(parseBrowserSession) : [],
    version: 2
  }
}

function parseBrowserSession (candidate: unknown): BrowserSession {
  if (!isRecord(candidate) || typeof candidate.id !== 'string' || typeof candidate.tokenHash !== 'string' ||
      typeof candidate.createdAt !== 'string' || typeof candidate.expiresAt !== 'string' ||
      !Number.isFinite(Date.parse(candidate.createdAt)) || !Number.isFinite(Date.parse(candidate.expiresAt))) {
    throw new Error('Control Deck pairing credentials contain an invalid browser session.')
  }
  return {
    createdAt: candidate.createdAt,
    expiresAt: candidate.expiresAt,
    id: candidate.id,
    ...(typeof candidate.name === 'string' ? { name: candidate.name } : {}),
    tokenHash: candidate.tokenHash
  }
}

function readableCode (): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const characters = [...randomBytes(10)].map(byte => alphabet[byte % alphabet.length]).join('')
  return `${characters.slice(0, 5)}-${characters.slice(5)}`
}

function normalizeCode (value: string): string { return value.trim().toUpperCase().replaceAll(/[^A-Z0-9]/gu, '') }

function safeEqual (left: string, right: string): boolean {
  const leftBytes = Buffer.from(left)
  const rightBytes = Buffer.from(right)
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes)
}

function hashChallenge (challenge: string): string {
  return createHmac('sha256', 'control-deck-pairing-challenge').update(challenge).digest('base64url')
}

function parseCookies (header: string | undefined): Record<string, string> {
  if (!header) return {}
  return Object.fromEntries(header.split(';').flatMap(part => {
    const separator = part.indexOf('=')
    return separator < 1 ? [] : [[part.slice(0, separator).trim(), part.slice(separator + 1).trim()]]
  }))
}

function isRecord (value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
