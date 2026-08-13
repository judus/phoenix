import type { JsonObject, LocalTool } from '@judus/llm-client'
import type { DisplayCommands } from './tool-gateways.js'

export class DisplayShowSystemTool implements LocalTool {
  public readonly definition = {
    annotations: { destructive: false, idempotent: true, openWorld: false, readOnly: false },
    description: 'Open the PHOENIX Terminal system schematic on the commander\'s connected PHOENIX screens, optionally selecting a named body or station. This navigates PHOENIX; it does not open the full-screen System Map inside Elite Dangerous. If the commander merely says "system map" and the intended interface is unclear, ask which one.',
    inputSchema: { additionalProperties: false, properties: { objectName: { type: 'string' }, systemName: { type: 'string' } }, type: 'object' },
    name: 'display.show_system'
  }
  public constructor (private readonly display: DisplayCommands) {}
  public readonly execute = (arguments_: JsonObject) => this.display.showSystem(arguments_)
}
