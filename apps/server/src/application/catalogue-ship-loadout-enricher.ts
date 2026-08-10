import type {
  CurrentShip,
  ShipDefinition,
  ShipModule,
  ShipSlotDefinition
} from '@phoenix/contracts'
import type { GameCatalogue } from '@phoenix/elite'
import type { ShipLoadoutEnricher } from '../domain/ship-loadout.js'

const coreSlotIndexes: Record<string, number> = {
  PowerPlant: 0,
  MainEngines: 1,
  FrameShiftDrive: 2,
  LifeSupport: 3,
  PowerDistributor: 4,
  Radar: 5,
  FuelTank: 6
}

export class CatalogueShipLoadoutEnricher implements ShipLoadoutEnricher {
  public constructor (private readonly catalogue: GameCatalogue) {}

  public enrich (ship: CurrentShip): CurrentShip {
    const definition = ship.typeId ? this.catalogue.resolveShip(ship.typeId) : null
    const expectedSlots = definition ? expectedSlotsFor(ship.modules, definition) : new Map<string, ShipSlotDefinition>()
    return {
      ...ship,
      definition,
      modules: ship.modules.map(module => ({
        ...module,
        definition: this.catalogue.resolveModule(module.moduleId),
        expectedSlot: expectedSlots.get(module.slotId) ?? null
      }))
    }
  }
}

function expectedSlotsFor (
  modules: ShipModule[],
  ship: ShipDefinition
): Map<string, ShipSlotDefinition> {
  const result = new Map<string, ShipSlotDefinition>()
  const hardpoints = [...ship.slots.hardpoints]
  const optional = [...ship.slots.optional]
  const genericOptional = optional.filter(slot => !slot.name)

  for (const module of modules) {
    if (module.slotGroup === 'core') {
      const index = coreSlotIndexes[module.slotId]
      const slot = index === undefined ? null : ship.slots.core[index]
      if (slot) result.set(module.slotId, slot)
      continue
    }

    if (module.slotGroup === 'utility') {
      const index = slotOrdinal(module.slotId) - 1
      const slot = ship.slots.utilities[index]
      if (slot) result.set(module.slotId, slot)
      continue
    }

    if (module.slotGroup === 'hardpoint') {
      const miningOnly = /MiningHardpoint/i.test(module.slotId)
      const index = hardpoints.findIndex(slot =>
        slot.size === module.slotSize && Boolean(slot.name?.toLowerCase().includes('mining')) === miningOnly
      )
      const fallbackIndex = hardpoints.findIndex(slot => slot.size === module.slotSize)
      const selectedIndex = index >= 0 ? index : fallbackIndex
      const slot = selectedIndex >= 0 ? hardpoints.splice(selectedIndex, 1)[0] : null
      if (slot) result.set(module.slotId, slot)
      continue
    }

    if (module.slotGroup === 'optional') {
      const genericMatch = module.slotId.match(/^Slot(\d+)_Size\d+$/i)
      if (genericMatch) {
        const slot = genericOptional[Number.parseInt(genericMatch[1] ?? '0', 10) - 1]
        if (slot) result.set(module.slotId, slot)
        continue
      }
      const expectedName = dedicatedOptionalName(module.slotId)
      const slot = expectedName
        ? optional.find(candidate => candidate.name?.toLowerCase().includes(expectedName))
        : null
      if (slot) result.set(module.slotId, slot)
    }
  }

  return result
}

function dedicatedOptionalName (slotId: string): string | null {
  if (/^LimpetController/i.test(slotId)) return 'limpet'
  if (/^FighterBay/i.test(slotId)) return 'fighter'
  if (/^PlanetaryApproachSuite/i.test(slotId)) return 'planetaryapproachsuite'
  return null
}

function slotOrdinal (slotId: string): number {
  const match = slotId.match(/(\d+)$/)?.[1]
  return match ? Number.parseInt(match, 10) : 0
}
