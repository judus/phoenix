import type { JsonObject } from '@jdu/llm-client'
import type { SystemCartography } from '../domain/cartography.js'
import type { RuntimeStateReader } from '../domain/runtime-state.js'
import type { SystemDetailsQuery } from './mcp-tools/tool-gateways.js'
import { json, optionalStringArgument, output } from './mcp-tools/tool-support.js'

export class DefaultSystemDetailsQuery implements SystemDetailsQuery {
  public constructor (
    private readonly cartography: SystemCartography,
    private readonly runtimeState: RuntimeStateReader
  ) {}

  public async getDetails (arguments_: JsonObject) {
    const requestedName = optionalStringArgument(arguments_, 'systemName')
    const name = requestedName ?? this.runtimeState.getCurrent().system.name
    if (!name) return output('The current system is unknown.', { system: null })
    const result = await this.cartography.getSystem(name)
    const system = result.system
    const summary = {
      name: system.name,
      address: system.address,
      position: system.position,
      permitRequired: system.permitRequired,
      permitName: system.permitName,
      information: system.information,
      primaryStar: system.primaryStar,
      bodies: system.bodies.map(body => ({
        id: body.id,
        id64: body.id64,
        bodyId: body.bodyId,
        name: body.name,
        type: body.type,
        subType: body.subType,
        distanceToArrival: body.distanceToArrival,
        parents: body.parents
      })),
      stations: system.stations.map(station => ({
        id: station.id,
        marketId: station.marketId,
        name: station.name,
        type: station.type,
        distanceToArrival: station.distanceToArrival,
        allegiance: station.allegiance,
        government: station.government,
        economy: station.economy,
        secondEconomy: station.secondEconomy,
        controllingFaction: station.controllingFaction,
        services: station.services,
        facilities: station.facilities
      })),
      source: system.source,
      cache: result.cache
    }
    return output([
      `System: ${system.name}`,
      `Allegiance: ${system.information.allegiance ?? 'unknown'}; government: ${system.information.government ?? 'unknown'}; security: ${system.information.security ?? 'unknown'}`,
      `Economy: ${system.information.primaryEconomy ?? 'unknown'}${system.information.secondaryEconomy ? ` / ${system.information.secondaryEconomy}` : ''}; population: ${system.information.population?.toLocaleString() ?? 'unknown'}`,
      `Known bodies: ${system.bodies.length}; known stations: ${system.stations.length}`
    ].join('\n'), json(summary))
  }
}
