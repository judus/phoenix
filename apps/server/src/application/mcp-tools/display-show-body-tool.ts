import type { JsonObject, LocalTool } from '@judus/llm-client'
import type { DisplayCommands } from './tool-gateways.js'

export class DisplayShowBodyTool implements LocalTool {
  public readonly definition = {
    annotations: { destructive: false, idempotent: true, openWorld: false, readOnly: false },
    description: 'Open PHOENIX Terminal body details for a specific planet, moon, star, or other celestial body on the commander\'s connected PHOENIX screens. This navigates PHOENIX; it does not open a map inside Elite Dangerous. Use an information tool instead when only facts are needed.',
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
