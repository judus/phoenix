import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { createServer, type Server, type ServerResponse } from 'node:http'
import { extname, relative, resolve, sep } from 'node:path'
import { KeyboardCommandAdapter, RecordingKeyboardOutput } from '@jdu/control-deck-adapter-keyboard'
import { ControlDeckCommandService, PairingService } from '@jdu/control-deck-core'
import {
  CommandHttpController,
  DeckConfigurationHttpController,
  FileControlDeckConfigurationRepository,
  FilePairingCredentialsRepository,
  NodePairingSecurity,
  PairingHttpController
} from '@jdu/control-deck-host'

export interface ControlDeckApplicationOptions {
  dataDirectory: string
  host?: string
  port?: number
  webDirectory?: string
}

export class ControlDeckApplication {
  public readonly pairing: PairingHttpController
  public readonly keyboardOutput: RecordingKeyboardOutput
  private readonly commands: ControlDeckCommandService
  private readonly commandHttp: CommandHttpController
  private readonly configurationHttp: DeckConfigurationHttpController
  private readonly host: string
  private readonly port: number
  private readonly server: Server
  private readonly webDirectory?: string

  public constructor (options: ControlDeckApplicationOptions) {
    this.host = options.host ?? '127.0.0.1'
    this.port = options.port ?? 3410
    this.webDirectory = options.webDirectory ? resolve(options.webDirectory) : undefined
    this.pairing = new PairingHttpController(
      new PairingService(
        new FilePairingCredentialsRepository(resolve(options.dataDirectory, 'pairing.json')),
        new NodePairingSecurity()
      ),
      { cookieName: 'control_deck_session' }
    )
    this.keyboardOutput = new RecordingKeyboardOutput()
    this.commands = new ControlDeckCommandService(
      [new KeyboardCommandAdapter(this.keyboardOutput)],
      { createId: randomUUID }
    )
    this.commandHttp = new CommandHttpController(this.commands, {
      ownerKey: request => this.pairing.ownerKey(request)
    })
    this.configurationHttp = new DeckConfigurationHttpController(
      new FileControlDeckConfigurationRepository(resolve(options.dataDirectory, 'decks.json'))
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
    await this.commands.start()
    try {
      await new Promise<void>((resolvePromise, reject) => {
        this.server.once('error', reject)
        this.server.listen(this.port, this.host, () => {
          this.server.off('error', reject)
          resolvePromise()
        })
      })
    } catch (cause) {
      await this.commands.stop()
      throw cause
    }
    const address = this.server.address()
    if (!address || typeof address === 'string') throw new Error('Control Deck server has no TCP address.')
    return { host: this.host, port: address.port }
  }

  public async stop (): Promise<void> {
    try {
      if (this.server.listening) {
        await new Promise<void>((resolvePromise, reject) => {
          this.server.close(error => error ? reject(error) : resolvePromise())
        })
      }
    } finally {
      await this.commands.stop()
    }
  }

  private async handle (request: Parameters<typeof this.pairing.handle>[0], response: ServerResponse): Promise<void> {
    if (await this.pairing.handle(request, response)) return
    const path = new URL(request.url ?? '/', 'http://control-deck.local').pathname
    if (path.startsWith('/api/') && !this.pairing.isAuthorized(request)) {
      writeJson(response, 401, {
        error: { code: 'pairing_required', message: 'Pair this device with Control Deck.' }
      })
      return
    }
    if (await this.configurationHttp.handle(request, response)) return
    if (await this.commandHttp.handle(request, response)) return
    if (request.method === 'GET' && path === '/api/health') {
      writeJson(response, 200, { name: 'Control Deck', status: 'ok' })
      return
    }
    if ((request.method === 'GET' || request.method === 'HEAD') && this.webDirectory) {
      await this.serveWebAsset(path, request.method === 'HEAD', response)
      return
    }
    writeJson(response, 404, { error: { code: 'not_found', message: 'Route not found.' } })
  }

  private async serveWebAsset (path: string, headOnly: boolean, response: ServerResponse): Promise<void> {
    const relativePath = path === '/' ? 'index.html' : decodeURIComponent(path.slice(1))
    let filePath = resolve(this.webDirectory!, relativePath)
    const resolvedRelative = relative(this.webDirectory!, filePath)
    if (resolvedRelative === '..' || resolvedRelative.startsWith(`..${sep}`)) {
      writeJson(response, 404, { error: { code: 'not_found', message: 'Route not found.' } })
      return
    }
    let body: Buffer
    try {
      body = await readFile(filePath)
    } catch {
      if (extname(relativePath) !== '') {
        writeJson(response, 404, { error: { code: 'not_found', message: 'Asset not found.' } })
        return
      }
      filePath = resolve(this.webDirectory!, 'index.html')
      body = await readFile(filePath)
    }
    response.statusCode = 200
    response.setHeader('content-type', contentType(filePath))
    response.setHeader('cache-control', filePath.endsWith('index.html') ? 'no-cache' : 'public, max-age=31536000, immutable')
    response.end(headOnly ? undefined : body)
  }
}

function writeJson (response: ServerResponse, status: number, body: unknown): void {
  if (response.headersSent) return
  response.statusCode = status
  response.setHeader('content-type', 'application/json; charset=utf-8')
  response.end(`${JSON.stringify(body)}\n`)
}

function contentType (path: string): string {
  return ({
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp'
  } as Record<string, string>)[extname(path)] ?? 'application/octet-stream'
}
