import type { JsonObject, LocalTool } from '@maduser/ai-ts'
import type { RuntimeStateReader } from '../../domain/runtime-state.js'
import { boundedLimit, displayName, optionalIntegerArgument, optionalStringArgument, output } from './tool-support.js'

export class ShipGetCargoTool implements LocalTool {
  public readonly definition = {
    annotations: { readOnly: true },
    description: 'Return cargo capacity and a compact cargo manifest for the current or last known ship.',
    inputSchema: {
      additionalProperties: false,
      properties: { limit: { maximum: 50, minimum: 1, type: 'integer' }, query: { type: 'string' } },
      type: 'object'
    },
    name: 'ship.get_cargo'
  }

  public constructor (private readonly runtimeState: RuntimeStateReader) {}

  public readonly execute = (arguments_: JsonObject) => {
    const state = this.runtimeState.getCurrent()
    const cargo = state.inventory.cargo
    const query = optionalStringArgument(arguments_, 'query')?.toLowerCase()
    const items = (cargo?.items ?? [])
      .map(item => ({ ...item, name: displayName(item.label, item.id) }))
      .filter(item => query === undefined || item.name.toLowerCase().includes(query) || item.id.toLowerCase().includes(query))
      .slice(0, boundedLimit(optionalIntegerArgument(arguments_, 'limit'), 20, 50))
    const used = cargo?.items.reduce((sum, item) => sum + item.count, 0) ?? state.gameStatus?.cargo ?? null
    const header = `Cargo: ${used ?? 'unknown'} / ${state.ship.cargoCapacity ?? 'unknown'} t`
    const text = items.length === 0 ? `${header}\nNo matching cargo.` : [header, ...items.map(item => `- ${item.name}: ${item.count}${item.stolen > 0 ? ` (${item.stolen} stolen)` : ''}${item.missionId ? ` (mission ${item.missionId})` : ''}`)].join('\n')
    return output(text, { capacityT: state.ship.cargoCapacity, items, usedT: used, vessel: cargo?.vessel ?? null })
  }
}
