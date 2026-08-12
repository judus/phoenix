import type { JsonObject, LocalTool } from '@judus/llm-client'
import type { ShipModule } from '@phoenix/contracts'
import type { RuntimeStateReader } from '../../domain/runtime-state.js'
import { boundedLimit, json, optionalBooleanArgument, optionalIntegerArgument, optionalStringArgument, output } from './tool-support.js'

export class ShipListModulesTool implements LocalTool {
  public readonly definition = {
    annotations: { readOnly: true },
    description: 'List installed ship modules. Filter by category, name, engineering, or damage when needed.',
    inputSchema: {
      additionalProperties: false,
      properties: {
        category: { enum: ['core', 'hardpoint', 'utility', 'optional', 'ship', 'other'], type: 'string' },
        damagedOnly: { type: 'boolean' },
        engineeredOnly: { type: 'boolean' },
        limit: { maximum: 50, minimum: 1, type: 'integer' },
        query: { type: 'string' }
      },
      type: 'object'
    },
    name: 'ship.list_modules'
  }

  public constructor (private readonly runtimeState: RuntimeStateReader) {}

  public readonly execute = (arguments_: JsonObject) => {
    const ship = this.runtimeState.getCurrent().ship
    const category = optionalStringArgument(arguments_, 'category')
    const query = optionalStringArgument(arguments_, 'query')?.toLowerCase()
    const modules = ship.modules
      .filter(module => category === undefined || module.slotGroup === category)
      .filter(module => !(optionalBooleanArgument(arguments_, 'damagedOnly') ?? false) || (module.health !== null && module.health < 1))
      .filter(module => !(optionalBooleanArgument(arguments_, 'engineeredOnly') ?? false) || module.engineering !== null)
      .filter(module => query === undefined || moduleSearchText(module).includes(query))
      .slice(0, boundedLimit(optionalIntegerArgument(arguments_, 'limit'), 20, 50))
    const hull = ship.definition?.displayName ?? ship.typeId ?? 'current ship'
    const text = modules.length === 0 ? `No modules matched for ${hull}.` : [`Modules for ${hull}${ship.name ? ` "${ship.name}"` : ''}:`, ...modules.map(formatModule)].join('\n')
    return output(text, json({ hull, modules }))
  }
}

function moduleSearchText (module: ShipModule): string {
  return [module.slotId, module.moduleId, module.definition?.displayName, module.definition?.category, module.expectedSlot?.name].filter(Boolean).join(' ').toLowerCase()
}

function formatModule (module: ShipModule): string {
  const name = module.definition?.displayName ?? module.moduleId
  const size = module.moduleSize ?? module.slotSize
  const rating = module.definition?.rating ?? (module.moduleClass === null ? null : String(module.moduleClass))
  const details = [
    module.health === null ? null : `health ${Math.round(module.health * 100)}%`,
    module.enabled === false ? 'disabled' : null,
    module.engineering ? `engineered ${module.engineering.blueprintName ?? 'unknown'} G${module.engineering.level ?? '?'}${module.engineering.experimentalEffectLabel ? ` / ${module.engineering.experimentalEffectLabel}` : ''}` : 'engineered no'
  ].filter(Boolean)
  return `- ${module.slotId} (${module.slotGroup}${module.slotSize ? `, slot ${module.slotSize}` : ''}): ${size ?? '?'}${rating ?? '?'} ${name}; ${details.join('; ')}`
}
