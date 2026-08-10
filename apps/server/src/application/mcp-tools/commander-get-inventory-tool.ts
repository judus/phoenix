import type { JsonObject, LocalTool } from '@maduser/ai-ts'
import type { RuntimeStateReader } from '../../domain/runtime-state.js'
import { boundedLimit, displayName, optionalIntegerArgument, optionalStringArgument, output } from './tool-support.js'

export class CommanderGetInventoryTool implements LocalTool {
  public readonly definition = {
    annotations: { readOnly: true },
    description: 'List the commander\'s on-foot ship-locker inventory, optionally filtered by resource type or name.',
    inputSchema: {
      additionalProperties: false,
      properties: {
        limit: { maximum: 100, minimum: 1, type: 'integer' },
        query: { type: 'string' },
        type: { enum: ['item', 'component', 'consumable', 'data'], type: 'string' }
      },
      type: 'object'
    },
    name: 'commander.get_inventory'
  }

  public constructor (private readonly runtimeState: RuntimeStateReader) {}

  public readonly execute = (arguments_: JsonObject) => {
    const inventory = this.runtimeState.getCurrent().inventory.shipLocker
    if (!inventory) return output('Ship-locker inventory is not available yet.', { available: false, items: [] })
    const type = optionalStringArgument(arguments_, 'type')
    const query = optionalStringArgument(arguments_, 'query')?.toLowerCase()
    const groups = [
      ['item', inventory.items],
      ['component', inventory.components],
      ['consumable', inventory.consumables],
      ['data', inventory.data]
    ] as const
    const items = groups
      .filter(([group]) => type === undefined || group === type)
      .flatMap(([group, values]) => values.map(item => ({ ...item, type: group, name: displayName(item.label, item.id) })))
      .filter(item => query === undefined || item.name.toLowerCase().includes(query) || item.id.toLowerCase().includes(query))
      .slice(0, boundedLimit(optionalIntegerArgument(arguments_, 'limit'), 30, 100))
    const text = items.length === 0
      ? 'No ship-locker inventory items matched.'
      : ['Ship-locker inventory:', ...items.map(item => `- ${item.name} (${item.type}): ${item.count}${item.missionId ? `; mission ${item.missionId}` : ''}`)].join('\n')
    return output(text, { available: true, items, updatedAt: inventory.updatedAt })
  }
}
