import type { JsonObject } from '@jdu/llm-client'
import type { CartographicSystem, NavigationRouteHop } from '@phoenix/contracts'
import type { SystemCartography } from '../domain/cartography.js'
import type { NavigationRouteReader } from '../domain/navigation.js'
import type { RuntimeStateReader } from '../domain/runtime-state.js'
import type { NavigationQuery } from './mcp-tools/tool-gateways.js'
import { json, output, stringArgument } from './mcp-tools/tool-support.js'

export class DefaultNavigationQuery implements NavigationQuery {
  public constructor (
    private readonly routes: NavigationRouteReader,
    private readonly cartography: SystemCartography,
    private readonly runtimeState: RuntimeStateReader
  ) {}

  public async getRoute () {
    const route = this.routes.getCurrent()
    if (route.route.length === 0) return output('No navigation route is currently plotted.', { route: [] })
    const currentName = this.runtimeState.getCurrent().system.name
    const currentIndex = currentName
      ? route.route.findIndex(hop => sameName(hop.system, currentName))
      : -1
    const nextIndex = Math.min(currentIndex >= 0 ? currentIndex + 1 : 0, route.route.length - 1)
    const next = route.route[nextIndex] ?? null
    const destination = route.route.at(-1) ?? null
    const summaries = await Promise.all(route.route.map(hop => this.enrichHop(hop, currentName)))
    return output([
      `Current system: ${currentName ?? 'unknown'}`,
      `Next hop: ${next?.system ?? 'none'}`,
      `Destination: ${destination?.system ?? 'none'}`,
      `Remaining jumps: ${currentIndex >= 0 ? Math.max(route.route.length - currentIndex - 1, 0) : route.route.length}`
    ].join('\n'), json({ timestamp: route.timestamp, currentSystem: currentName, next, destination, route: summaries }))
  }

  public async canJumpTo (arguments_: JsonObject) {
    const targetName = stringArgument(arguments_, 'systemName')
    const state = this.runtimeState.getCurrent()
    const originName = state.system.name
    const range = state.ship.maxJumpRange
    if (!originName || !state.system.position) return output('The current system position is unknown.', { canJump: null, targetSystem: targetName })
    if (range === null) return output('The current ship jump range is unknown.', { canJump: null, targetSystem: targetName })
    const target = (await this.cartography.getSystem(targetName)).system
    if (!target.position) return output(`Coordinates for ${target.name} are unknown.`, { canJump: null, targetSystem: target.name })
    const distanceLy = distance(state.system.position, target.position)
    const canJump = distanceLy <= range
    return output(
      `${target.name} is ${distanceLy.toFixed(2)} Ly away; current maximum jump range is ${range.toFixed(2)} Ly. ${canJump ? 'A single jump is within range.' : 'A single jump is out of range.'}`,
      { originSystem: originName, targetSystem: target.name, distanceLy, maximumJumpRangeLy: range, canJump }
    )
  }

  private async enrichHop (hop: NavigationRouteHop, currentName: string | null) {
    try {
      const system = (await this.cartography.getSystem(hop.system)).system
      return hopSummary(hop, system, currentName)
    } catch {
      return hopSummary(hop, null, currentName)
    }
  }
}

function hopSummary (hop: NavigationRouteHop, system: CartographicSystem | null, currentName: string | null) {
  return {
    ...hop,
    isCurrentSystem: currentName ? sameName(hop.system, currentName) : false,
    knownBodies: system?.bodies.length ?? null,
    knownStars: system?.bodies.filter(body => body.type === 'Star').length ?? null,
    knownPlanets: system?.bodies.filter(body => body.type === 'Planet').length ?? null,
    knownStations: system?.stations.length ?? null
  }
}

function distance (left: [number, number, number], right: [number, number, number]): number {
  return Math.hypot(left[0] - right[0], left[1] - right[1], left[2] - right[2])
}

function sameName (left: string, right: string): boolean {
  return left.toLocaleLowerCase() === right.toLocaleLowerCase()
}
