import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import type { IncomingMessage } from 'node:http'
import { dirname } from 'node:path'
import type { PairingStatus } from '@phoenix/contracts'

interface PairingCredentials {
  installationId: string
  pairingCode: string
  secret: string
  version: 1
}

export class PairingAttemptLimitError extends Error {}

export class PairingAccessController {
  private readonly credentials: PairingCredentials
  private readonly failedAttempts: number[] = []

  public constructor (credentialsFile: string) {
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

  public claim (candidate: string): boolean {
    const now = Date.now()
    while (this.failedAttempts[0] !== undefined && this.failedAttempts[0] < now - 60_000) {
      this.failedAttempts.shift()
    }
    if (this.failedAttempts.length >= 10) throw new PairingAttemptLimitError('Too many pairing attempts. Try again in one minute.')
    const valid = safeEqual(normalizeCode(candidate), normalizeCode(this.credentials.pairingCode))
    if (!valid) this.failedAttempts.push(now)
    else this.failedAttempts.length = 0
    return valid
  }

  public isAuthorized (request: IncomingMessage): boolean {
    const authorization = request.headers.authorization
    if (authorization?.startsWith('Bearer ')) {
      return safeEqual(authorization.slice('Bearer '.length).trim(), this.credentials.secret)
    }
    const session = parseCookies(request.headers.cookie).phoenix_session
    return session !== undefined && safeEqual(session, this.browserSessionToken())
  }

  public sessionCookie (): string {
    return `phoenix_session=${this.browserSessionToken()}; HttpOnly; SameSite=Strict; Path=/; Max-Age=31536000`
  }

  public clearSessionCookie (): string {
    return 'phoenix_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'
  }

  private browserSessionToken (): string {
    return createHmac('sha256', this.credentials.secret).update('phoenix-browser-session-v1').digest('base64url')
  }
}

function loadOrCreateCredentials (path: string): PairingCredentials {
  if (existsSync(path)) return parseCredentials(JSON.parse(readFileSync(path, 'utf8')))
  const credentials: PairingCredentials = {
    installationId: randomUUID(),
    pairingCode: readableCode(),
    secret: randomBytes(32).toString('base64url'),
    version: 1
  }
  mkdirSync(dirname(path), { recursive: true })
  const temporary = `${path}.tmp-${process.pid}`
  writeFileSync(temporary, `${JSON.stringify(credentials, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 })
  renameSync(temporary, path)
  return credentials
}

function parseCredentials (candidate: unknown): PairingCredentials {
  if (!isRecord(candidate) || candidate.version !== 1 ||
      typeof candidate.installationId !== 'string' || typeof candidate.pairingCode !== 'string' ||
      typeof candidate.secret !== 'string' || candidate.secret.length < 32) {
    throw new Error('PHOENIX pairing credentials are invalid.')
  }
  return candidate as unknown as PairingCredentials
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
