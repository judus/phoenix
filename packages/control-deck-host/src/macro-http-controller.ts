import type { IncomingMessage, ServerResponse } from 'node:http'
import {
  ControlDeckMacroDefinitionSchema,
  type ControlDeckMacroCommandAdapter,
  type ControlDeckMacroRepository
} from '@jdu/control-deck-core'
import { readJsonBody, writeJson } from './http-json.js'

export class MacroHttpController {
  public constructor (
    private readonly repository: ControlDeckMacroRepository,
    private readonly adapter: ControlDeckMacroCommandAdapter,
    private readonly pathPrefix = '/api/macros'
  ) {}

  public async handle (request: IncomingMessage, response: ServerResponse): Promise<boolean> {
    const path = new URL(request.url ?? '/', 'http://control-deck.local').pathname
    if (request.method === 'GET' && path === this.pathPrefix) {
      writeJson(response, 200, this.repository.getLibrary())
      return true
    }
    if (request.method === 'POST' && path === this.pathPrefix) {
      try {
        writeJson(response, 200, this.repository.save(ControlDeckMacroDefinitionSchema.parse(await readJsonBody(request))))
      } catch (cause) {
        this.writeError(response, cause)
      }
      return true
    }
    if (path === `${this.pathPrefix}/playback` && request.method === 'GET') {
      writeJson(response, 200, this.adapter.getPlayback())
      return true
    }
    if (path === `${this.pathPrefix}/playback` && request.method === 'DELETE') {
      writeJson(response, 200, this.adapter.abortPlayback())
      return true
    }
    if (request.method === 'DELETE' && path.startsWith(`${this.pathPrefix}/`)) {
      try {
        const id = decodeURIComponent(path.slice(this.pathPrefix.length + 1))
        if (!/^[a-z][a-z0-9_-]{0,63}$/u.test(id)) throw new Error('Invalid macro ID.')
        this.repository.delete(id)
        writeJson(response, 200, this.repository.getLibrary())
      } catch (cause) {
        this.writeError(response, cause)
      }
      return true
    }
    return false
  }

  private writeError (response: ServerResponse, cause: unknown): void {
    writeJson(response, 400, {
      error: {
        code: 'macro_request_invalid',
        message: cause instanceof Error ? cause.message : 'Invalid macro request.'
      }
    })
  }
}
