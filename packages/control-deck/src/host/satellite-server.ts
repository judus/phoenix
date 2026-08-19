import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import type {
  CommandCatalogue,
  CommandExecutionResult,
  ControlGridLayout,
  NumpadExecutionResult,
  NumpadTreeSnapshot
} from '../core/index.js'
import { PairingAccessController, PairingAttemptLimitError } from './pairing-access.js'

export interface SatelliteServerAddress { host: string, port: number }

export interface SatelliteServerOptions {
  access: PairingAccessController
  commands: {
    execute(candidate: unknown, signal?: AbortSignal): Promise<CommandExecutionResult>
    getCatalog(): CommandCatalogue
  }
  host: string
  layout: { getLayout(): ControlGridLayout }
  numpad: {
    execute(candidate: unknown, signal?: AbortSignal): Promise<NumpadExecutionResult>
    getSnapshot(): NumpadTreeSnapshot
  }
  port: number
}

export class ControlDeckSatelliteServer {
  private readonly server: Server

  public constructor (private readonly options: SatelliteServerOptions) {
    this.server = createServer((request, response) => {
      void this.handle(request, response).catch(cause => {
        this.writeJson(response, 500, { error: { code: 'internal_error', message: errorMessage(cause) } })
      })
    })
  }

  public async start (): Promise<SatelliteServerAddress> {
    await new Promise<void>((resolve, reject) => {
      this.server.once('error', reject)
      this.server.listen(this.options.port, this.options.host, () => {
        this.server.off('error', reject)
        resolve()
      })
    })
    const address = this.server.address()
    if (!address || typeof address === 'string') throw new Error('Control Deck satellite gateway has no TCP address.')
    return { host: this.options.host, port: address.port }
  }

  public async stop (): Promise<void> {
    if (!this.server.listening) return
    await new Promise<void>((resolve, reject) => this.server.close(error => error ? reject(error) : resolve()))
  }

  private async handle (request: IncomingMessage, response: ServerResponse): Promise<void> {
    const url = new URL(request.url ?? '/', 'http://control-deck.local')
    if (request.method === 'GET' && url.pathname === '/api/pairing/status') {
      this.writeJson(response, 200, this.options.access.status(request))
      return
    }
    if (request.method === 'POST' && url.pathname === '/api/pairing/claim') {
      try {
        const body = await readJsonBody(request)
        const candidate = isRecord(body) && typeof body.challenge === 'string'
          ? body.challenge
          : isRecord(body) && typeof body.code === 'string' ? body.code : ''
        const token = this.options.access.claim(candidate, isRecord(body) && typeof body.deviceName === 'string' ? body.deviceName : undefined)
        if (!token) {
          this.writeJson(response, 401, { error: { code: 'pairing_code_invalid', message: 'The pairing code is invalid.' } })
          return
        }
        response.setHeader('set-cookie', this.options.access.sessionCookie(token))
        this.writeJson(response, 200, { authenticated: true, installationId: this.options.access.installationId, pairingRequired: true })
      } catch (cause) {
        const limited = cause instanceof PairingAttemptLimitError
        this.writeJson(response, limited ? 429 : 400, { error: { code: limited ? 'pairing_rate_limited' : 'pairing_request_invalid', message: errorMessage(cause) } })
      }
      return
    }
    if (request.method === 'POST' && url.pathname === '/api/pairing/release') {
      this.options.access.release(request)
      response.setHeader('set-cookie', this.options.access.clearSessionCookie())
      this.writeJson(response, 200, { authenticated: false })
      return
    }
    if (!this.options.access.isAuthorized(request)) {
      response.setHeader('www-authenticate', 'Bearer realm="Control Deck"')
      this.writeJson(response, 401, { error: { code: 'pairing_required', message: 'Pair this device with Control Deck.' } })
      return
    }
    if (request.method === 'GET' && url.pathname === '/api/pairing/sessions') {
      this.writeJson(response, 200, { sessions: this.options.access.listSessions() })
      return
    }
    const sessionMatch = url.pathname.match(/^\/api\/pairing\/sessions\/([^/]+)$/u)
    if (request.method === 'DELETE' && sessionMatch) {
      this.writeJson(response, 200, { revoked: this.options.access.revokeSession(decodeURIComponent(sessionMatch[1]!)) })
      return
    }
    if (request.method === 'GET' && url.pathname === '/api/commands') {
      this.writeJson(response, 200, this.options.commands.getCatalog())
      return
    }
    if (request.method === 'POST' && url.pathname === '/api/commands/execute') {
      this.writeJson(response, 200, await this.options.commands.execute(await readJsonBody(request)))
      return
    }
    if (request.method === 'GET' && url.pathname === '/api/control-layout') {
      this.writeJson(response, 200, this.options.layout.getLayout())
      return
    }
    if (request.method === 'GET' && url.pathname === '/api/numpad') {
      this.writeJson(response, 200, this.options.numpad.getSnapshot())
      return
    }
    if (request.method === 'POST' && url.pathname === '/api/numpad/execute') {
      this.writeJson(response, 200, await this.options.numpad.execute(await readJsonBody(request)))
      return
    }
    this.writeJson(response, 404, { error: { code: 'not_found', message: 'This endpoint is not available on the Control Deck satellite gateway.' } })
  }

  private writeJson (response: ServerResponse, status: number, value: unknown): void {
    if (response.headersSent) return
    const body = JSON.stringify(value)
    response.writeHead(status, { 'cache-control': 'no-store', 'content-length': Buffer.byteLength(body), 'content-type': 'application/json; charset=utf-8' })
    response.end(body)
  }
}

async function readJsonBody (request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > 64 * 1024) throw new Error('Request body is too large.')
    chunks.push(buffer)
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
}

function errorMessage (cause: unknown): string { return cause instanceof Error ? cause.message : 'Unknown gateway error.' }
function isRecord (value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value) }
