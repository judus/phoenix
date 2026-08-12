import type { JsonObject, LocalTool } from '@judus/llm-client'
import type { JsonValue } from '@judus/llm-client'
import type { RuntimeState } from '@phoenix/contracts'
import type { RuntimeStateReader } from '../../domain/runtime-state.js'
import { emptyObjectSchema, output } from './tool-support.js'

export class CommanderGetCurrentStateTool implements LocalTool {
  public readonly definition = {
    annotations: { readOnly: true },
    description: 'Read a compact fresh PHOENIX telemetry snapshot: commander, system, location, ship, fuel, cargo, destination, and active status flags. Use when request-time context may be stale or the commander asks for the current situation.',
    inputSchema: emptyObjectSchema(),
    name: 'commander.get_current_state'
  }

  public constructor (private readonly runtimeState: RuntimeStateReader) {}

  public readonly execute = () => {
    const summary = summarizeRuntimeState(this.runtimeState.getCurrent())
    return output(runtimeStateText(summary), summary)
  }
}

function summarizeRuntimeState (state: RuntimeState): JsonObject {
  const status = state.gameStatus
  const activeFlags = status
    ? Object.entries({ ...status.flags, ...status.flags2 }).filter(([, enabled]) => enabled).map(([flag]) => flag)
    : []
  const place = state.location.place
  return {
    revision: state.revision,
    updatedAt: state.updatedAt,
    commander: { name: state.commander.name },
    system: { name: state.system.name },
    location: { state: state.location.state, place: place === null ? null : { kind: place.kind, name: place.name, type: place.type } },
    ship: {
      cargoCapacity: state.ship.cargoCapacity,
      hull: state.ship.definition?.displayName ?? state.ship.typeId,
      identifier: state.ship.identifier,
      jumpRangeLy: state.ship.maxJumpRange,
      name: state.ship.name
    },
    status: status === null ? null : {
      activeFlags,
      cargoT: status.cargo,
      destination: status.destination?.name ?? null,
      fuelMainT: status.fuel?.main ?? null,
      fuelReservoirT: status.fuel?.reservoir ?? null,
      legalState: status.legalState,
      pips: status.pips
    }
  }
}

function runtimeStateText (summary: JsonObject): string {
  const commander = summary.commander as JsonObject
  const system = summary.system as JsonObject
  const location = summary.location as JsonObject
  const ship = summary.ship as JsonObject
  const status = summary.status as JsonObject | null
  const place = location.place as JsonObject | null
  const flags = status?.activeFlags as readonly JsonValue[] | undefined
  return [
    `Commander: ${commander.name ?? 'unknown'}`,
    `System: ${system.name ?? 'unknown'}; location: ${location.state}${place ? ` at ${place.name}` : ''}`,
    `Ship: ${ship.hull ?? 'unknown'}${ship.name ? ` "${ship.name}"` : ''}; jump range: ${ship.jumpRangeLy ?? 'unknown'} Ly; cargo capacity: ${ship.cargoCapacity ?? 'unknown'} T`,
    `Status: ${flags && flags.length > 0 ? flags.join(', ') : 'no active flags reported'}`
  ].join('\n')
}
