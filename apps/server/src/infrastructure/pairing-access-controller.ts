import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import type { IncomingMessage } from 'node:http'
import { dirname } from 'node:path'
import type { PairingStatus } from '@phoenix/contracts'

interface BrowserSession {
  createdAt: string
  expiresAt: string
  id: string
  tokenHash: string
}

interface PairingCredentials {
  installationId: string
  pairingCode: string
  secret: string
  sessions: BrowserSession[]
  version: 2
}

export class PairingAttemptLimitError extends Error {}

export class PairingAccessController {
  private readonly credentials: PairingCredentials
  private readonly failedAttempts: number[] = []

  public constructor (private readonly credentialsFile: string) {
    this.credentials = loadOrCreateCredentials(credentialsFile)
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

  public status (request: IncomingMessage): PairingStatus {
    return {
      authenticated: this.isAuthorized(request),
      installationId: this.installationId,
      pairingRequired: true
    }
  }

  public claim (candidate: string): string | null {
    const now = Date.now()
    while (this.failedAttempts[0] !== undefined && this.failedAttempts[0] < now - 60_000) {
      this.failedAttempts.shift()
    }
    if (this.failedAttempts.length >= 10) throw new PairingAttemptLimitError('Too many pairing attempts. Try again in one minute.')
    const valid = safeEqual(normalizeCode(candidate), normalizeCode(this.credentials.pairingCode))
    if (!valid) {
      this.failedAttempts.push(now)
      return null
    }
    this.failedAttempts.length = 0
    return this.createBrowserSession(now)
  }

  public isAuthorized (request: IncomingMessage): boolean {
    const authorization = request.headers.authorization
    if (authorization?.startsWith('Bearer ')) {
      return safeEqual(authorization.slice('Bearer '.length).trim(), this.credentials.secret)
    }
    const session = parseCookies(request.headers.cookie).phoenix_session
    if (session === undefined) return false
    const now = Date.now()
    this.pruneExpiredSessions(now)
    const tokenHash = this.browserSessionTokenHash(session)
    return this.credentials.sessions.some(candidate => safeEqual(candidate.tokenHash, tokenHash))
  }

  public sessionCookie (token: string): string {
    return `phoenix_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=31536000`
  }

  public clearSessionCookie (): string {
    return 'phoenix_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'
  }

  public release (request: IncomingMessage): boolean {
    const token = parseCookies(request.headers.cookie).phoenix_session
    if (!token) return false
    const tokenHash = this.browserSessionTokenHash(token)
    const retained = this.credentials.sessions.filter(session => !safeEqual(session.tokenHash, tokenHash))
    if (retained.length === this.credentials.sessions.length) return false
    this.credentials.sessions = retained
    writeCredentials(this.credentialsFile, this.credentials)
    return true
  }

  private createBrowserSession (now: number): string {
    this.pruneExpiredSessions(now)
    const token = randomBytes(32).toString('base64url')
    this.credentials.sessions.push({
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + 365 * 24 * 60 * 60 * 1000).toISOString(),
      id: randomUUID(),
      tokenHash: this.browserSessionTokenHash(token)
    })
    this.credentials.sessions = this.credentials.sessions.slice(-64)
    writeCredentials(this.credentialsFile, this.credentials)
    return token
  }

  private browserSessionTokenHash (token: string): string {
    return createHmac('sha256', this.credentials.secret).update(token).digest('base64url')
  }

  private pruneExpiredSessions (now: number): void {
    const retained = this.credentials.sessions.filter(session => Date.parse(session.expiresAt) > now)
    if (retained.length === this.credentials.sessions.length) return
    this.credentials.sessions = retained
    writeCredentials(this.credentialsFile, this.credentials)
  }
}

function loadOrCreateCredentials (path: string): PairingCredentials {
  if (existsSync(path)) return parseCredentials(JSON.parse(readFileSync(path, 'utf8')))
  const credentials: PairingCredentials = {
    installationId: randomUUID(),
    pairingCode: readableCode(),
    secret: randomBytes(32).toString('base64url'),
    sessions: [],
    version: 2
  }
  writeCredentials(path, credentials)
  return credentials
}

function parseCredentials (candidate: unknown): PairingCredentials {
  if (!isRecord(candidate) || ![1, 2].includes(candidate.version as number) ||
      typeof candidate.installationId !== 'string' || typeof candidate.pairingCode !== 'string' ||
      typeof candidate.secret !== 'string' || candidate.secret.length < 32) {
    throw new Error('PHOENIX pairing credentials are invalid.')
  }
  return {
    installationId: candidate.installationId,
    pairingCode: candidate.pairingCode,
    secret: candidate.secret,
    sessions: candidate.version === 2 && Array.isArray(candidate.sessions)
      ? candidate.sessions.map(parseBrowserSession)
      : [],
    version: 2
  }
}

function parseBrowserSession (candidate: unknown): BrowserSession {
  if (!isRecord(candidate) || typeof candidate.id !== 'string' ||
      typeof candidate.tokenHash !== 'string' || typeof candidate.createdAt !== 'string' ||
      typeof candidate.expiresAt !== 'string' || !Number.isFinite(Date.parse(candidate.createdAt)) ||
      !Number.isFinite(Date.parse(candidate.expiresAt))) {
    throw new Error('PHOENIX pairing credentials contain an invalid browser session.')
  }
  return candidate as unknown as BrowserSession
}

function writeCredentials (path: string, credentials: PairingCredentials): void {
  mkdirSync(dirname(path), { recursive: true })
  const temporary = `${path}.tmp-${process.pid}`
  writeFileSync(temporary, `${JSON.stringify(credentials, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 })
  chmodSync(temporary, 0o600)
  renameSync(temporary, path)
  chmodSync(path, 0o600)
}

function readableCode (): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = randomBytes(10)
  const characters = [...bytes].map(byte => alphabet[byte % alphabet.length]).join('')
  return `${characters.slice(0, 5)}-${characters.slice(5)}`
}

function normalizeCode (value: string): string {
  return value.trim().toUpperCase().replaceAll(/[^A-Z0-9]/gu, '')
}

function safeEqual (left: string, right: string): boolean {
  const leftBytes = Buffer.from(left)
  const rightBytes = Buffer.from(right)
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes)
}

function parseCookies (header: string | undefined): Record<string, string> {
  if (!header) return {}
  return Object.fromEntries(header.split(';').flatMap(part => {
    const separator = part.indexOf('=')
    if (separator < 1) return []
    return [[part.slice(0, separator).trim(), part.slice(separator + 1).trim()]]
  }))
}

function isRecord (value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
