import type { JsonObject, LocalTool } from '@jdu/llm-client'
import type { FleetDataReader } from '../../domain/fleet.js'
import { json, output } from './tool-support.js'

export class FleetListShipsTool implements LocalTool {
  public readonly definition = {
    annotations: { readOnly: true },
    description: 'List the commander\'s locally reconstructed owned ships, including the active vessel, stored locations, transfer state, values, and honest unknowns.',
    inputSchema: { additionalProperties: false, properties: {}, type: 'object' },
    name: 'fleet.list_ships'
  }

  public constructor (private readonly fleet: FleetDataReader) {}

  public readonly execute = (_arguments: JsonObject) => {
    const response = this.fleet.getFleet()
    const text = response.ships.length === 0
      ? 'No owned ships have been reconstructed from the local journal.'
      : response.ships.map(ship => {
          const name = ship.name ? `${ship.displayName ?? ship.typeId ?? 'Unknown hull'} “${ship.name}”` : ship.displayName ?? ship.typeId ?? `Ship ${ship.id}`
          const location = [ship.system, ship.station].filter(Boolean).join(' / ')
          return `- ${name} (#${ship.id}): ${ship.state}${location ? `; ${location}` : ''}${ship.value === null ? '' : `; ${ship.value.toLocaleString('en-US')} CR`}`
        }).join('\n')
    return output(text, json({ activeShipId: response.activeShipId, ships: response.ships, summary: response.summary }))
  }
}
