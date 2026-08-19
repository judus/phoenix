import { createServer, type Server, type ServerResponse } from 'node:http'
import { resolve } from 'node:path'
import { PairingService } from '@jdu/control-deck-core'
import {
  FilePairingCredentialsRepository,
  NodePairingSecurity,
  PairingHttpController
} from '@jdu/control-deck-host'

export interface ControlDeckApplicationOptions {
  dataDirectory: string
  host?: string
  port?: number
}

export class ControlDeckApplication {
  public readonly pairing: PairingHttpController
  private readonly host: string
  private readonly port: number
  private readonly server: Server

  public constructor (options: ControlDeckApplicationOptions) {
    this.host = options.host ?? '127.0.0.1'
    this.port = options.port ?? 3410
    this.pairing = new PairingHttpController(
      new PairingService(
        new FilePairingCredentialsRepository(resolve(options.dataDirectory, 'pairing.json')),
        new NodePairingSecurity()
      ),
      { cookieName: 'control_deck_session' }
    )
    this.server = createServer((request, response) => {
      void this.handle(request, response).catch(cause => {
        writeJson(response, 500, {
          error: {
            code: 'internal_error',
            message: cause instanceof Error ? cause.message : 'Control Deck request failed.'
          }
        })
      })
    })
  }

  public async start (): Promise<{ host: string, port: number }> {
    await new Promise<void>((resolvePromise, reject) => {
      this.server.once('error', reject)
      this.server.listen(this.port, this.host, () => {
        this.server.off('error', reject)
        resolvePromise()
      })
    })
    const address = this.server.address()
    if (!address || typeof address === 'string') throw new Error('Control Deck server has no TCP address.')
    return { host: this.host, port: address.port }
  }

  public async stop (): Promise<void> {
    if (!this.server.listening) return
    await new Promise<void>((resolvePromise, reject) => {
      this.server.close(error => error ? reject(error) : resolvePromise())
    })
  }

  private async handle (request: Parameters<typeof this.pairing.handle>[0], response: ServerResponse): Promise<void> {
    if (await this.pairing.handle(request, response)) return
    const path = new URL(request.url ?? '/', 'http://control-deck.local').pathname
    if (request.method === 'GET' && path === '/api/health') {
      if (!this.pairing.isAuthorized(request)) {
        writeJson(response, 401, {
          error: { code: 'pairing_required', message: 'Pair this device with Control Deck.' }
        })
        return
      }
      writeJson(response, 200, { name: 'Control Deck', status: 'ok' })
      return
    }
    writeJson(response, 404, { error: { code: 'not_found', message: 'Route not found.' } })
  }
}

function writeJson (response: ServerResponse, status: number, body: unknown): void {
  if (response.headersSent) return
  response.statusCode = status
  response.setHeader('content-type', 'application/json; charset=utf-8')
  response.end(`${JSON.stringify(body)}\n`)
}
