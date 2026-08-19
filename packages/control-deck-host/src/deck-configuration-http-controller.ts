import type { IncomingMessage, ServerResponse } from 'node:http'
import {
  ControlDeckConfigurationSchema,
  type ControlDeckConfigurationRepository
} from '@jdu/control-deck-core'
import { readJsonBody, writeJson } from './http-json.js'

export interface DeckConfigurationHttpControllerOptions {
  path?: string
}

export class DeckConfigurationHttpController {
  private readonly path: string

  public constructor (
    private readonly configurations: ControlDeckConfigurationRepository,
    options: DeckConfigurationHttpControllerOptions = {}
  ) {
    this.path = options.path ?? '/api/configuration'
  }

  public async handle (request: IncomingMessage, response: ServerResponse): Promise<boolean> {
    const path = new URL(request.url ?? '/', 'http://control-deck.local').pathname
    if (request.method === 'GET' && path === this.path) {
      writeJson(response, 200, this.configurations.getConfiguration())
      return true
    }
    if (request.method === 'PUT' && path === this.path) {
      try {
        const configuration = ControlDeckConfigurationSchema.parse(await readJsonBody(request))
        writeJson(response, 200, this.configurations.saveConfiguration(configuration))
      } catch (cause) {
        writeJson(response, 400, {
          error: {
            code: 'deck_configuration_invalid',
            message: cause instanceof Error ? cause.message : 'Invalid Control Deck configuration.'
          }
        })
      }
      return true
    }
    return false
  }
}
