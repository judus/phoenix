import type { JsonObject, LocalTool } from '@maduser/ai-ts'
import type { DisplayCommands } from './tool-gateways.js'

export class DisplayShowBodyTool implements LocalTool {
  public readonly definition = {
    annotations: { destructive: false, idempotent: true, openWorld: false, readOnly: false },
    description: 'Show a detailed visual view of a specific planet, moon, star, or other celestial body to the commander. Use when the commander asks to see or visually inspect a body; use an information tool when facts are needed.',
    inputSchema: {
      additionalProperties: false,
      properties: { bodyName: { minLength: 1, type: 'string' }, systemName: { type: 'string' } },
      required: ['bodyName'],
      type: 'object'
    },
    name: 'display.show_body'
  }
  public constructor (private readonly display: DisplayCommands) {}
  public readonly execute = (arguments_: JsonObject) => this.display.showBody(arguments_)
}
