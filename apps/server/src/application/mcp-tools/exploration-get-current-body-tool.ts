import type { JsonObject, LocalTool } from '@jdu/llm-client'
import type { ExplorationBodyQuery } from './tool-gateways.js'
import { emptyObjectSchema } from './tool-support.js'

export class ExplorationGetCurrentBodyTool implements LocalTool {
  public readonly definition = {
    annotations: { readOnly: true },
    description: 'Return detected biological and geological signals plus biological sample progress for the current or last nearby body. Local journal history may be incomplete.',
    inputSchema: emptyObjectSchema(),
    name: 'exploration.get_current_body'
  }
  public constructor (private readonly bodies: ExplorationBodyQuery) {}
  public readonly execute = (arguments_: JsonObject) => this.bodies.getCurrentBody(arguments_)
}
