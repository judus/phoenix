import type { JsonObject, LocalTool } from '@judus/llm-client'
import type { RuntimeStateReader } from '../../domain/runtime-state.js'
import { boundedLimit, displayName, optionalBooleanArgument, optionalIntegerArgument, optionalStringArgument, output } from './tool-support.js'

export class CommanderListMaterialsTool implements LocalTool {
  public readonly definition = {
    annotations: { readOnly: true },
    description: 'List engineering materials, optionally filtered by name, category, or low stock. PHOENIX reports journal counts; storage capacity and material grade are not currently available.',
    inputSchema: {
      additionalProperties: false,
      properties: {
        limit: { maximum: 100, minimum: 1, type: 'integer' },
        lowStockOnly: { description: 'Return materials with fewer than 25 units.', type: 'boolean' },
        query: { type: 'string' },
        type: { enum: ['raw', 'manufactured', 'encoded'], type: 'string' }
      },
      type: 'object'
    },
    name: 'commander.list_materials'
  }

  public constructor (private readonly runtimeState: RuntimeStateReader) {}

  public readonly execute = (arguments_: JsonObject) => {
    const materials = this.runtimeState.getCurrent().inventory.materials
    if (!materials) return output('Engineering materials are not available yet.', { available: false, materials: [] })
    const type = optionalStringArgument(arguments_, 'type')
    const query = optionalStringArgument(arguments_, 'query')?.toLowerCase()
    const lowStockOnly = optionalBooleanArgument(arguments_, 'lowStockOnly') ?? false
    const groups = [['raw', materials.raw], ['manufactured', materials.manufactured], ['encoded', materials.encoded]] as const
    const result = groups
      .filter(([category]) => type === undefined || category === type)
      .flatMap(([category, values]) => values.map(material => ({ ...material, category, name: displayName(material.label, material.id) })))
      .filter(material => query === undefined || material.name.toLowerCase().includes(query) || material.id.toLowerCase().includes(query))
      .filter(material => !lowStockOnly || material.count < 25)
      .slice(0, boundedLimit(optionalIntegerArgument(arguments_, 'limit'), 30, 100))
    const text = result.length === 0 ? 'No engineering materials matched.' : ['Engineering materials:', ...result.map(material => `- ${material.name} (${material.category}): ${material.count}`)].join('\n')
    return output(text, { available: true, materials: result, updatedAt: materials.updatedAt })
  }
}
