import { randomUUID } from 'node:crypto'
import { createServer, type Server, type ServerResponse } from 'node:http'
import { resolve } from 'node:path'
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
    writeJson(response, 404, { error: { code: 'not_found', message: 'Route not found.' } })
  }
}

function writeJson (response: ServerResponse, status: number, body: unknown): void {
  if (response.headersSent) return
  response.statusCode = status
  response.setHeader('content-type', 'application/json; charset=utf-8')
  response.end(`${JSON.stringify(body)}\n`)
}
