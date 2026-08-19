import type { IncomingMessage, ServerResponse } from 'node:http'
import type { ControlDeckCommandService } from '@jdu/control-deck-core'
import { readJsonBody, writeJson } from './http-json.js'

export interface CommandHttpControllerOptions {
  ownerKey: (request: IncomingMessage) => string | null
  pathPrefix?: string
}

export class CommandHttpController {
  private readonly pathPrefix: string

  public constructor (
    private readonly commands: ControlDeckCommandService,
    private readonly options: CommandHttpControllerOptions
  ) {
    this.pathPrefix = options.pathPrefix ?? '/api/commands'
  }

  public async handle (request: IncomingMessage, response: ServerResponse): Promise<boolean> {
    const path = new URL(request.url ?? '/', 'http://control-deck.local').pathname
    if (request.method === 'GET' && path === this.pathPrefix) {
      writeJson(response, 200, this.commands.getCatalogue())
      return true
    }
    if (request.method === 'POST' && path === `${this.pathPrefix}/execute`) {
      try {
        const ownerKey = this.options.ownerKey(request)
        if (!ownerKey) {
          writeJson(response, 401, {
            error: { code: 'command_authorization_required', message: 'Command authorization is required.' }
          })
          return true
        }
        const result = await this.commands.execute(
          await readJsonBody(request),
          ownerKey,
          AbortSignal.timeout(30_000)
        )
        writeJson(response, 200, result)
      } catch (cause) {
        writeJson(response, 400, {
          error: {
            code: 'command_request_invalid',
            message: cause instanceof Error ? cause.message : 'Invalid command request.'
          }
        })
      }
      return true
    }
    return false
  }
}
