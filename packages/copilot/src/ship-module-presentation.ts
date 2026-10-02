import type { ShipModule } from '@phoenix/contracts'

/** Ship infrastructure is retained in telemetry, but is not interchangeable outfitting. */
export function isOutfittingModule(module: ShipModule): boolean {
  return module.slotGroup !== 'ship'
}

export function copilotModuleName(module: ShipModule): string {
  const definition = module.definition
  if (!definition || definition.source.kind !== 'catalogue') return `Unidentified module (journal identifier: ${module.moduleId})`
  const size = definition.size ?? module.moduleSize
  const specification = size !== null && definition.rating ? `${size}${definition.rating} ` : ''
  return specification + definition.displayName
}

export function modulePurpose(module: ShipModule): string | null {
  const id = module.moduleId.toLowerCase()
  if (/^int_fighterbay(?:mk2)?_/.test(id)) return 'carries ship-launched fighters; not an SRV hangar'
  if (/^int_buggybay(?:mk2)?_/.test(id)) return 'carries surface vehicles (SRVs); not a fighter hangar'
  return null
}

export const OUTFITTING_GUIDANCE = 'Use the exact catalogue module names below. Slot identifiers are locations, not module names. Do not substitute a different module type or treat built-in ship infrastructure as removable optional internals. A previous conversation claim is not evidence of the current loadout.'
