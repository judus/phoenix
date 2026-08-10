import { createReadStream, existsSync, statSync } from 'node:fs'
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse
} from 'node:http'
import { extname, isAbsolute, join, normalize, relative, resolve, sep } from 'node:path'
import type { RuntimeState } from '@phoenix/contracts'
import type { CatalogueDiagnosticsReader } from '../application/catalogue-diagnostics-service.js'
import type { GameActions } from '../application/game-action-service.js'
import type { HealthCheck } from '../application/health-service.js'
import type { EliteJournalDiagnosticsReader } from '../domain/elite-journal.js'
import type { EliteStatusDiagnosticsReader } from '../domain/elite-status.js'
import type { Subscribable } from '../domain/publisher.js'
import type { RuntimeStateReader } from '../domain/runtime-state.js'

const CONTENT_TYPES: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
}

export interface PhoenixHttpServerOptions {
  catalogueDiagnostics: CatalogueDiagnosticsReader
  gameActions: GameActions
  eliteJournalDiagnostics: EliteJournalDiagnosticsReader
  eliteStatusDiagnostics: EliteStatusDiagnosticsReader
  healthCheck: HealthCheck
  host: string
  port: number
  runtimeState: RuntimeStateReader
  runtimeStateUpdates: Subscribable<RuntimeState>
  webRoot: string
}

export class PhoenixHttpServer {
  private readonly eventStreams = new Set<ServerResponse>()
  private readonly server: Server

  public constructor (private readonly options: PhoenixHttpServerOptions) {
    this.server = createServer((request, response) => {
      void this.handle(request, response).catch(cause => {
        const message = cause instanceof Error ? cause.message : 'Unknown server error.'
        this.writeJson(response, 500, {
          error: { code: 'internal_error', message }
        })
      })
    })
  }

  public async start (): Promise<{ host: string, port: number }> {
    await new Promise<void>((resolvePromise, reject) => {
      this.server.once('error', reject)
      this.server.listen(this.options.port, this.options.host, () => {
        this.server.off('error', reject)
        resolvePromise()
      })
    })

    const address = this.server.address()
    if (!address || typeof address === 'string') throw new Error('PHOENIX server has no TCP address.')
    return { host: this.options.host, port: address.port }
  }

  public async stop (): Promise<void> {
    if (!this.server.listening) return
    for (const stream of this.eventStreams) stream.end()
    this.eventStreams.clear()
    await new Promise<void>((resolvePromise, reject) => {
      this.server.close(error => error ? reject(error) : resolvePromise())
    })
  }

  private async handle (request: IncomingMessage, response: ServerResponse): Promise<void> {
    const url = new URL(request.url ?? '/', 'http://phoenix.local')

    if (request.method === 'GET' && url.pathname === '/api/health') {
      this.writeJson(response, 200, this.options.healthCheck.getHealth())
      return
    }

    if (request.method === 'GET' && url.pathname === '/api/runtime-state') {
      this.writeJson(response, 200, this.options.runtimeState.getCurrent())
      return
    }

    if (request.method === 'GET' && url.pathname === '/api/runtime-state/stream') {
      this.openRuntimeStateStream(request, response)
      return
    }

    if (request.method === 'GET' && ['/api/actions', '/api/developer/actions'].includes(url.pathname)) {
      this.writeJson(response, 200, this.options.gameActions.getCatalog())
      return
    }

    if (request.method === 'GET' && url.pathname === '/api/developer/catalogue') {
      this.writeJson(response, 200, this.options.catalogueDiagnostics.getDiagnostics())
      return
    }

    if (request.method === 'GET' && url.pathname === '/api/developer/elite-status') {
      this.writeJson(response, 200, this.options.eliteStatusDiagnostics.getDiagnostics())
      return
    }

    if (request.method === 'GET' && url.pathname === '/api/developer/elite-journal') {
      this.writeJson(response, 200, this.options.eliteJournalDiagnostics.getDiagnostics())
      return
    }

    if (
      request.method === 'POST' &&
      ['/api/actions/execute', '/api/developer/actions/execute'].includes(url.pathname)
    ) {
      try {
        const origin = url.pathname.startsWith('/api/developer/') ? 'developer' : 'ui'
        const result = await this.options.gameActions.execute(await readJsonBody(request), origin)
        this.writeJson(response, 200, result)
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : 'Invalid action request.'
        this.writeJson(response, 400, {
          error: { code: 'invalid_action_request', message }
        })
      }
      return
    }

    if (url.pathname.startsWith('/api/')) {
      this.writeJson(response, 404, {
        error: { code: 'not_found', message: `No PHOENIX endpoint exists at ${url.pathname}.` }
      })
      return
    }

    this.serveWebAsset(url.pathname, response)
  }

  private openRuntimeStateStream (request: IncomingMessage, response: ServerResponse): void {
    response.writeHead(200, {
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'content-type': 'text/event-stream; charset=utf-8'
    })
    response.flushHeaders()
    this.eventStreams.add(response)

    const send = (state: RuntimeState): void => {
      response.write(`event: runtime-state\ndata: ${JSON.stringify(state)}\n\n`)
    }
    const unsubscribe = this.options.runtimeStateUpdates.subscribe(send)
    let closed = false
    const close = (): void => {
      if (closed) return
      closed = true
      unsubscribe()
      this.eventStreams.delete(response)
    }

    request.once('close', close)
    response.once('close', close)
    send(this.options.runtimeState.getCurrent())
  }

  private serveWebAsset (pathname: string, response: ServerResponse): void {
    const root = resolve(this.options.webRoot)
    const requested = pathname === '/' ? 'index.html' : pathname.slice(1)
    const candidate = resolve(root, normalize(requested))
    const candidateRelativePath = relative(root, candidate)
    const isInsideRoot = candidateRelativePath !== '..' && !candidateRelativePath.startsWith(`..${sep}`) && !isAbsolute(candidateRelativePath)
    const file = isInsideRoot && existsSync(candidate) && statSync(candidate).isFile()
      ? candidate
      : join(root, 'index.html')

    if (!existsSync(file)) {
      this.writeJson(response, 404, {
        error: {
          code: 'web_not_built',
          message: 'PHOENIX web assets are not built. Run npm run dev or npm run build.'
        }
      })
      return
    }

    response.writeHead(200, {
      'cache-control': file.endsWith('index.html') ? 'no-cache' : 'public, max-age=3600',
      'content-type': CONTENT_TYPES[extname(file)] ?? 'application/octet-stream'
    })
    createReadStream(file).pipe(response)
  }

  private writeJson (response: ServerResponse, status: number, payload: unknown): void {
    const body = JSON.stringify(payload)
    response.writeHead(status, {
      'cache-control': 'no-store',
      'content-length': Buffer.byteLength(body),
      'content-type': 'application/json; charset=utf-8'
    })
    response.end(body)
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
