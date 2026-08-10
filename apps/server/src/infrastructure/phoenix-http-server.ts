import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer, type Server, type ServerResponse } from 'node:http'
import { extname, isAbsolute, join, normalize, relative, resolve, sep } from 'node:path'
import type { HealthCheck } from '../application/health-service.js'

const CONTENT_TYPES: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
}

export interface PhoenixHttpServerOptions {
  healthCheck: HealthCheck
  host: string
  port: number
  webRoot: string
}

export class PhoenixHttpServer {
  private readonly server: Server

  public constructor (private readonly options: PhoenixHttpServerOptions) {
    this.server = createServer((request, response) => {
      this.handle(request.url ?? '/', response)
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
    await new Promise<void>((resolvePromise, reject) => {
      this.server.close(error => error ? reject(error) : resolvePromise())
    })
  }

  private handle (requestUrl: string, response: ServerResponse): void {
    const url = new URL(requestUrl, 'http://phoenix.local')

    if (url.pathname === '/api/health') {
      this.writeJson(response, 200, this.options.healthCheck.getHealth())
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
