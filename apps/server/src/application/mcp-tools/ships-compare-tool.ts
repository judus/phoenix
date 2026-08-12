import type { JsonObject, LocalTool } from '@judus/llm-client'
import type { ShipDefinition, ShipSlotDefinition } from '@phoenix/contracts'
import type { GameCatalogue } from '@phoenix/elite'
import { json, output, stringArrayArgument } from './tool-support.js'

export class ShipsCompareTool implements LocalTool {
  public readonly definition = {
    annotations: { readOnly: true },
    description: 'Compare 2 to 4 specific ship hulls using canonical catalogue data. Returns baseline hull statistics and slot capacity, not a fitted-build simulation.',
    inputSchema: {
      additionalProperties: false,
      properties: { identifiers: { items: { minLength: 1, type: 'string' }, maxItems: 4, minItems: 2, type: 'array' } },
      required: ['identifiers'],
      type: 'object'
    },
    name: 'ships.compare'
  }

  public constructor (private readonly catalogue: GameCatalogue) {}

  public readonly execute = (arguments_: JsonObject) => {
    const identifiers = stringArrayArgument(arguments_, 'identifiers')
    if (identifiers.length < 2 || identifiers.length > 4) throw new Error('identifiers must contain 2 to 4 ships.')
    const resolved = identifiers.map(identifier => ({ identifier, ship: this.catalogue.resolveShip(identifier) }))
    const missing = resolved.filter(result => result.ship === null).map(result => result.identifier)
    if (missing.length > 0) return output(`No canonical ship definition matches: ${missing.join(', ')}.`, { missing, ships: [] })
    const ships = resolved.map(result => result.ship as ShipDefinition)
    const text = [
      '| Ship | Pad | Hull mass | Armour | Shields | Speed / boost | Hardpoints | Utilities | Optional internals |',
      '| --- | --- | ---: | ---: | ---: | --- | --- | ---: | --- |',
      ...ships.map(formatComparison)
    ].join('\n')
    return output(text, json({ ships }))
  }
}

function formatComparison (ship: ShipDefinition): string {
  return `| ${ship.displayName} | ${ship.landingPadSize ?? 'unknown'} | ${ship.performance.hullMass ?? 'unknown'} t | ${ship.performance.baseArmour ?? 'unknown'} | ${ship.performance.baseShieldStrength ?? 'unknown'} | ${ship.performance.speed ?? 'unknown'} / ${ship.performance.boost ?? 'unknown'} m/s | ${describeSizes(ship.slots.hardpoints)} | ${ship.slots.utilities.length} | ${describeSizes(ship.slots.optional)} |`
}

function describeSizes (slots: ShipSlotDefinition[]): string {
  if (slots.length === 0) return 'none known'
  const counts = new Map<string, number>()
  for (const slot of slots) {
    const label = `${slot.size}${slot.name ? ` ${slot.name.toLowerCase()}-only` : ''}`
    counts.set(label, (counts.get(label) ?? 0) + 1)
  }
  return [...counts.entries()].sort(([left], [right]) => Number.parseInt(right) - Number.parseInt(left)).map(([label, count]) => `${count}x${label}`).join(', ')
}
