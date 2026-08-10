import type { JsonObject, LocalTool } from '@maduser/ai-ts'
import type { DisplayCommands } from './tool-gateways.js'

export class DisplayShowSystemTool implements LocalTool {
  public readonly definition = {
    annotations: { destructive: false, idempotent: true, openWorld: false, readOnly: false },
    description: 'Show an interactive star-system map to the commander, optionally highlighting a named body or station. Use when the commander asks to see or visually inspect a system; use an information tool when facts are needed.',
    inputSchema: { additionalProperties: false, properties: { objectName: { type: 'string' }, systemName: { type: 'string' } }, type: 'object' },
    name: 'display.show_system'
  }
  public constructor (private readonly display: DisplayCommands) {}
  public readonly execute = (arguments_: JsonObject) => this.display.showSystem(arguments_)
}
