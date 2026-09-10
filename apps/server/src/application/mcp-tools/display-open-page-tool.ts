import type { JsonObject, LocalTool } from '@jdu/llm-client'
import type { DisplayCommands } from './tool-gateways.js'

export class DisplayOpenPageTool implements LocalTool {
  public readonly definition = {
    annotations: { destructive: false, idempotent: true, openWorld: false, readOnly: false },
    description: 'Open or show a PHOENIX page on connected displays. Pass the requested page name unchanged. This changes the PHOENIX display; use navigation information tools instead when the commander asks for route facts without asking to see a page.',
    inputSchema: {
      additionalProperties: false,
      properties: { page: { minLength: 1, type: 'string' } },
      required: ['page'],
      type: 'object'
    },
    name: 'display.open_page'
  }
  public constructor (private readonly display: DisplayCommands) {}
  public readonly execute = (arguments_: JsonObject) => this.display.openPage(arguments_)
}
