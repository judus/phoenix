import type { JsonObject, LocalTool } from '@jdu/llm-client'
import type { ShipModule } from '@phoenix/contracts'
import { copilotModuleName, isOutfittingModule, modulePurpose, OUTFITTING_GUIDANCE } from '@phoenix/copilot'
import type { RuntimeStateReader } from '../../domain/runtime-state.js'
import { boundedLimit, json, optionalBooleanArgument, optionalIntegerArgument, optionalStringArgument, output } from './tool-support.js'

export class ShipListModulesTool implements LocalTool {
  public readonly definition = {
    annotations: { readOnly: true },
    description: 'List current installed outfitting with exact catalogue names, sizes and ratings. Built-in ship infrastructure is excluded unless category=ship is explicitly requested. Filter by category, name, engineering, or damage. A truncated or unavailable loadout does not prove a module is absent.',
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
    name: 'ship.list_installed_modules'
  }

  public constructor (private readonly runtimeState: RuntimeStateReader) {}

  public readonly execute = (arguments_: JsonObject) => {
    const ship = this.runtimeState.getCurrent().ship
    const category = optionalStringArgument(arguments_, 'category')
    const query = optionalStringArgument(arguments_, 'query')?.toLowerCase()
    const matched = ship.modules
      .filter(module => category === 'ship' || isOutfittingModule(module))
      .filter(module => category === undefined || module.slotGroup === category)
      .filter(module => !(optionalBooleanArgument(arguments_, 'damagedOnly') ?? false) || (module.health !== null && module.health < 1))
      .filter(module => !(optionalBooleanArgument(arguments_, 'engineeredOnly') ?? false) || module.engineering !== null)
      .filter(module => query === undefined || moduleSearchText(module).includes(query))
    const modules = matched.slice(0, boundedLimit(optionalIntegerArgument(arguments_, 'limit'), 50, 50))
    const hull = ship.definition?.displayName ?? ship.typeId ?? 'current ship'
    const available = ship.modules.length > 0
    const truncated = modules.length < matched.length
    const text = !available ? `Loadout unavailable for ${hull}; do not infer installed modules or their absence.`
      : modules.length === 0 ? `No modules matched these filters for ${hull}.`
      : [`Modules for ${hull}${ship.name ? ` "${ship.name}"` : ''}:`, OUTFITTING_GUIDANCE, ...modules.map(formatModule),
        ...(truncated ? [`Showing ${modules.length} of ${matched.length} matches; omitted modules must not be treated as absent.`] : [])].join('\n')
    return output(text, json({ hull, modules, available, matched: matched.length, returned: modules.length, truncated }))
  }
}

function moduleSearchText (module: ShipModule): string {
  return [module.slotId, module.moduleId, module.definition?.displayName, module.definition?.category, module.expectedSlot?.name].filter(Boolean).join(' ').toLowerCase()
}

function formatModule (module: ShipModule): string {
  const name = copilotModuleName(module)
  const details = [
    modulePurpose(module),
    module.health === null ? null : `health ${Math.round(module.health * 100)}%`,
    module.enabled === false ? 'disabled' : null,
    module.engineering ? `engineered ${module.engineering.blueprintName ?? 'unknown'} G${module.engineering.level ?? '?'}${module.engineering.experimentalEffectLabel ? ` / ${module.engineering.experimentalEffectLabel}` : ''}` : 'engineered no'
  ].filter(Boolean)
  return `- ${name} (${module.slotGroup}, slot identifier: ${module.slotId}${module.slotSize ? `, slot capacity ${module.slotSize}` : ''}); ${details.join('; ')}`
}
