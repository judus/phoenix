import type { LocalTool } from '@judus/llm-client'
import type { RuntimeStateReader } from '../../domain/runtime-state.js'
import { emptyObjectSchema, json, output } from './tool-support.js'

export class ShipGetStatusTool implements LocalTool {
  public readonly definition = {
    annotations: { readOnly: true },
    description: 'Return a concise status summary for the commander\'s current or last known ship.',
    inputSchema: emptyObjectSchema(),
    name: 'ship.get_status'
  }

  public constructor (private readonly runtimeState: RuntimeStateReader) {}

  public readonly execute = () => {
    const state = this.runtimeState.getCurrent()
    const ship = state.ship
    const status = state.gameStatus
    const summary = {
      cargo: { capacityT: ship.cargoCapacity, currentT: status?.cargo ?? null },
      fuel: { capacity: ship.fuelCapacity, current: status?.fuel ?? null },
      hull: ship.definition?.displayName ?? ship.typeId,
      hullHealth: ship.hullHealth,
      identifier: ship.identifier,
      jumpRangeLy: ship.maxJumpRange,
      locationState: state.location.state,
      name: ship.name,
      pips: status?.pips ?? null,
      rebuyCredits: ship.rebuy,
      unladenMassT: ship.unladenMass
    }
    const text = [
      `Ship: ${summary.hull ?? 'unknown'}${ship.name ? ` "${ship.name}"` : ''}${ship.identifier ? ` (${ship.identifier})` : ''}`,
      `Location mode: ${state.location.state}`,
      `Hull health: ${ship.hullHealth === null ? 'unknown' : `${Math.round(ship.hullHealth * 100)}%`}`,
      `Fuel: ${status?.fuel?.main ?? 'unknown'} t; capacity: ${ship.fuelCapacity?.main ?? 'unknown'} t`,
      `Jump range: ${ship.maxJumpRange ?? 'unknown'} ly; cargo: ${status?.cargo ?? 'unknown'} / ${ship.cargoCapacity ?? 'unknown'} t`,
      `Mass: ${ship.unladenMass ?? 'unknown'} t; rebuy: ${ship.rebuy ?? 'unknown'} cr`,
      `PIPs: ${status?.pips ? `SYS ${status.pips.systems} / ENG ${status.pips.engines} / WEP ${status.pips.weapons}` : 'unknown'}`
    ].join('\n')
    return output(text, json(summary))
  }
}
