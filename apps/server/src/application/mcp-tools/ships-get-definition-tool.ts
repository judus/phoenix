import type { JsonObject, LocalTool } from '@maduser/ai-ts'
import type { ShipDefinition, ShipSlotDefinition } from '@phoenix/contracts'
import type { GameCatalogue } from '@phoenix/elite'
import { json, optionalStringArgument, output, stringArgument } from './tool-support.js'

export class ShipsGetDefinitionTool implements LocalTool {
  public readonly definition = {
    annotations: { readOnly: true },
    description: 'Resolve a ship name, game identifier, or catalogue alias and return its canonical hull definition. Use for a specific ship; do not browse the entire catalogue.',
    inputSchema: {
      additionalProperties: false,
      properties: { detail: { enum: ['summary', 'layout'], type: 'string' }, identifier: { minLength: 1, type: 'string' } },
      required: ['identifier'],
      type: 'object'
    },
    name: 'ships.get_definition'
  }

  public constructor (private readonly catalogue: GameCatalogue) {}

  public readonly execute = (arguments_: JsonObject) => {
    const identifier = stringArgument(arguments_, 'identifier')
    const ship = this.catalogue.resolveShip(identifier)
    if (!ship) return output(`No canonical ship definition matches "${identifier}".`, { identifier, ship: null })
    const lines = identityLines(ship)
    if ((optionalStringArgument(arguments_, 'detail') ?? 'summary') === 'layout') lines.push(...layoutLines(ship))
    return output(lines.join('\n'), json(ship))
  }
}

function identityLines (ship: ShipDefinition): string[] {
  return [
    `Ship: ${ship.displayName}`,
    `Canonical ID: ${ship.id}; Coriolis ID: ${ship.identifiers.coriolis}`,
    `Manufacturer: ${ship.manufacturer ?? 'unknown'}; landing pad: ${ship.landingPadSize ?? 'unknown'}`,
    `Baseline hull: ${ship.performance.hullMass ?? 'unknown'} t; armour: ${ship.performance.baseArmour ?? 'unknown'}; shields: ${ship.performance.baseShieldStrength ?? 'unknown'}; speed: ${ship.performance.speed ?? 'unknown'} m/s; boost: ${ship.performance.boost ?? 'unknown'} m/s`
  ]
}

function layoutLines (ship: ShipDefinition): string[] {
  return [
    `Core internals: ${ship.slots.core.map(slot => `${slot.name} class ${slot.size}`).join('; ') || 'unknown'}`,
    `Hardpoints: ${formatSlots(ship.slots.hardpoints)}`,
    `Optional internals: ${formatSlots(ship.slots.optional)}`,
    `Utility mounts: ${formatSlots(ship.slots.utilities)}`
  ]
}

function formatSlots (slots: ShipSlotDefinition[]): string {
  if (slots.length === 0) return 'none known'
  const counts = new Map<string, number>()
  for (const slot of slots) {
    const label = `class ${slot.size}${slot.name ? ` ${slot.name.toLowerCase()}-only` : ''}`
    counts.set(label, (counts.get(label) ?? 0) + 1)
  }
  return [...counts.entries()].map(([label, count]) => `${count}x ${label}`).join('; ')
}
