import {
  RuntimeStateSchema,
  type EliteGameStatus,
  type EngineeringMaterialAdjustment,
  type GameEventEnvelope,
  type RuntimeState
} from '@phoenix/contracts'
import type { Publisher } from '../domain/publisher.js'
import type {
  RuntimeStateProjector,
  RuntimeStateReader,
  RuntimeStateWriter
} from '../domain/runtime-state.js'
import {
  passThroughShipLoadoutEnricher,
  type ShipLoadoutEnricher
} from '../domain/ship-loadout.js'

export class DefaultRuntimeStateProjector implements RuntimeStateProjector {
  public constructor (
    private readonly store: RuntimeStateReader & RuntimeStateWriter,
    private readonly updates: Publisher<RuntimeState>,
    private readonly shipLoadoutEnricher: ShipLoadoutEnricher = passThroughShipLoadoutEnricher
  ) {}

  public project (event: GameEventEnvelope): RuntimeState {
    const current = this.store.getCurrent()
    const next = RuntimeStateSchema.parse({
      ...current,
      revision: current.revision + 1,
      updatedAt: event.ingestedAt,
      commander: event.type === 'commander.identity_changed'
        ? { ...current.commander, name: event.payload.name }
        : event.type === 'commander.ranks_changed'
          ? { ...current.commander, ranks: event.payload }
          : event.type === 'commander.rank_progress_changed'
            ? { ...current.commander, rankProgress: event.payload }
            : current.commander,
      ship: event.type === 'ship.loadout_changed'
        ? this.shipLoadoutEnricher.enrich(event.payload)
        : current.ship,
      inventory: event.type === 'inventory.cargo_changed'
        ? { ...current.inventory, cargo: event.payload }
        : event.type === 'inventory.materials_changed'
          ? { ...current.inventory, materials: event.payload }
          : event.type === 'inventory.material_adjusted'
            ? { ...current.inventory, materials: adjustMaterial(current.inventory.materials, event.payload) }
            : event.type === 'inventory.ship_locker_changed'
              ? { ...current.inventory, shipLocker: event.payload }
              : event.type === 'inventory.backpack_changed'
                ? { ...current.inventory, backpack: event.payload }
                : current.inventory,
      system: event.type === 'system.changed'
        ? event.payload
        : current.system,
      gameStatus: event.type === 'game.status_changed'
        ? event.payload
        : current.gameStatus,
      location: event.type === 'location.changed'
        ? event.payload
        : event.type === 'game.status_changed'
          ? { ...current.location, state: deriveLocationState(event.payload) }
          : current.location
    })

    this.store.replace(next)
    this.updates.publish(next)
    return next
  }
}

function adjustMaterial (
  materials: RuntimeState['inventory']['materials'],
  adjustment: EngineeringMaterialAdjustment
): RuntimeState['inventory']['materials'] {
  if (!materials) return null
  const category = materials[adjustment.category]
  const existing = category.find(material => material.id.toLowerCase() === adjustment.id.toLowerCase())
  const nextCount = Math.max(0, (existing?.count ?? 0) + adjustment.delta)
  const nextCategory = existing
    ? category
        .map(material => material === existing ? { ...material, count: nextCount } : material)
        .filter(material => material.count > 0)
    : nextCount > 0
      ? [...category, { id: adjustment.id, label: adjustment.label, count: nextCount }]
      : category
  return {
    ...materials,
    updatedAt: adjustment.updatedAt,
    [adjustment.category]: nextCategory
  }
}

function deriveLocationState (status: EliteGameStatus): RuntimeState['location']['state'] {
  if (status.flags2.onFoot) return 'on_foot'
  if (status.flags.inSrv) return 'in_srv'
  if (status.flags.fsdJump) return 'hyperspace'
  if (status.flags.supercruise) return 'supercruise'
  if (status.flags.docked) return 'docked'
  if (status.flags.landed) return 'landed'
  if (
    status.flags.inMainShip ||
    status.flags.inFighter ||
    status.flags2.inTaxi ||
    status.flags2.inMulticrew
  ) return 'in_space'
  return 'unknown'
}
