import type { IncomingMessage, ServerResponse } from 'node:http'
import {
  PairingAttemptLimitError,
  type PairingAccessEvidence,
  type PairingService,
  type PairingStatus
} from '@jdu/control-deck-core'

export interface PairingHttpControllerOptions {
  cookieName: string
  pathPrefix?: string
}

export class PairingHttpController {
  private readonly cookieName: string
  private readonly pathPrefix: string

  public constructor (
    private readonly pairing: PairingService,
    options: PairingHttpControllerOptions
  ) {
    this.cookieName = options.cookieName
    this.pathPrefix = options.pathPrefix ?? '/api/pairing'
  }

  public get installationId (): string {
    return this.pairing.installationId
  }

  public get pairingCode (): string {
    return this.pairing.pairingCode
  }

  public get bearerToken (): string {
    return this.pairing.bearerToken
  }

  public status (request: IncomingMessage): PairingStatus {
    return this.pairing.status(this.evidenceFrom(request))
  }

  public isAuthorized (request: IncomingMessage): boolean {
    return this.pairing.isAuthorized(this.evidenceFrom(request))
  }

  public async handle (request: IncomingMessage, response: ServerResponse): Promise<boolean> {
    const path = new URL(request.url ?? '/', 'http://control-deck.local').pathname
    if (request.method === 'GET' && path === `${this.pathPrefix}/status`) {
      writeJson(response, 200, this.status(request))
      return true
    }
    if (request.method === 'POST' && path === `${this.pathPrefix}/claim`) {
      await this.claim(request, response)
      return true
    }
    if (request.method === 'POST' && path === `${this.pathPrefix}/release`) {
      this.pairing.release(this.evidenceFrom(request).sessionToken)
      response.setHeader('set-cookie', this.clearSessionCookie())
      writeJson(response, 200, { authenticated: false })
      return true
    }
    return false
  }

  private async claim (request: IncomingMessage, response: ServerResponse): Promise<void> {
    try {
      const body = await readJsonBody(request)
      const code = isRecord(body) && typeof body.code === 'string' ? body.code : ''
      const token = this.pairing.claim(code)
      if (!token) {
        writeJson(response, 401, {
          error: { code: 'pairing_code_invalid', message: 'The pairing code is invalid.' }
        })
        return
      }
      response.setHeader('set-cookie', this.sessionCookie(token))
      writeJson(response, 200, {
        authenticated: true,
        installationId: this.installationId,
        pairingRequired: true
      })
    } catch (cause) {
      const limited = cause instanceof PairingAttemptLimitError
      writeJson(response, limited ? 429 : 400, {
        error: {
          code: limited ? 'pairing_rate_limited' : 'pairing_request_invalid',
          message: cause instanceof Error ? cause.message : 'Invalid pairing request.'
        }
      })
    }
  }

  private evidenceFrom (request: IncomingMessage): PairingAccessEvidence {
    const authorization = request.headers.authorization
    return {
      bearerToken: authorization?.startsWith('Bearer ')
        ? authorization.slice('Bearer '.length).trim()
        : undefined,
      sessionToken: parseCookies(request.headers.cookie)[this.cookieName]
    }
  }

  private sessionCookie (token: string): string {
    return `${this.cookieName}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=31536000`
  }

  private clearSessionCookie (): string {
    return `${this.cookieName}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`
  }
}

async function readJsonBody (request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  let length = 0
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    length += buffer.length
    if (length > 64 * 1024) throw new Error('Request body exceeds 64 KiB.')
    chunks.push(buffer)
  }
  if (chunks.length === 0) throw new Error('Request body is empty.')
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown
}

function parseCookies (header: string | undefined): Record<string, string> {
  if (!header) return {}
  return Object.fromEntries(header.split(';').flatMap(part => {
    const separator = part.indexOf('=')
    if (separator < 1) return []
    return [[part.slice(0, separator).trim(), part.slice(separator + 1).trim()]]
  }))
}

function writeJson (response: ServerResponse, status: number, body: unknown): void {
  response.statusCode = status
  response.setHeader('content-type', 'application/json; charset=utf-8')
  response.end(`${JSON.stringify(body)}\n`)
}

function isRecord (value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
