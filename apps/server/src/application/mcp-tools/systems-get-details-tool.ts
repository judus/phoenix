import type { JsonObject, LocalTool } from '@maduser/ai-ts'
import type { SystemDetailsQuery } from './tool-gateways.js'

export class SystemsGetDetailsTool implements LocalTool {
  public readonly definition = {
    annotations: { readOnly: true },
    description: 'Return faction, security, economy, population, coordinates, and station summary for a system. Defaults to the current system.',
    inputSchema: { additionalProperties: false, properties: { systemName: { type: 'string' } }, type: 'object' },
    name: 'systems.get_details'
  }
  public constructor (private readonly systems: SystemDetailsQuery) {}
  public readonly execute = (arguments_: JsonObject) => this.systems.getDetails(arguments_)
}
