import type { JsonObject, LocalTool } from '@judus/llm-client'
import type { FleetDataReader } from '../../domain/fleet.js'
import { boundedLimit, json, optionalIntegerArgument, optionalStringArgument, output } from './tool-support.js'

export class FleetListStoredModulesTool implements LocalTool {
  public readonly definition = {
    annotations: { readOnly: true },
    description: 'List stored ship modules from the latest authoritative local snapshot. The result explicitly reports partial data when module changes occurred after that snapshot.',
    inputSchema: {
      additionalProperties: false,
      properties: {
        limit: { maximum: 100, minimum: 1, type: 'integer' },
        system: { type: 'string' }
      },
      type: 'object'
    },
    name: 'fleet.list_stored_modules'
  }

  public constructor (private readonly fleet: FleetDataReader) {}

  public readonly execute = (arguments_: JsonObject) => {
    const response = this.fleet.getFleet().storedModules
    const system = optionalStringArgument(arguments_, 'system')
    const limit = boundedLimit(optionalIntegerArgument(arguments_, 'limit'), 40, 100)
    const modules = response.items
      .filter(module => system === undefined || module.system.localeCompare(system, undefined, { sensitivity: 'accent' }) === 0)
      .slice(0, limit)
    const caveat = response.details === 'complete' ? '' : ` Data quality: ${response.details}.`
    const text = modules.length === 0
      ? `No stored modules match.${caveat}`
      : `${modules.map(module => `- ${module.displayName ?? module.rawName}: ${module.system}${module.engineering ? `; engineered ${module.engineering.blueprint} G${module.engineering.level ?? '?'}` : ''}${module.hot ? '; hot' : ''}`).join('\n')}${caveat}`
    return output(text, json({ ...response, items: modules }))
  }
}
