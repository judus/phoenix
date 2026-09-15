import type { CommanderEquipmentCatalogue, CommanderEquipmentDefinition } from '../domain/commander-equipment.js'

const SUITS: Record<string, CommanderEquipmentDefinition> = {
  flightsuit: definition('Flight Suit', 'Remlok', 'Flight'),
  utilitysuit: definition('Maverick Suit', 'Remlok', 'Utility'),
  tacticalsuit: definition('Dominator Suit', 'Manticore', 'Combat'),
  explorationsuit: definition('Artemis Suit', 'Supratech', 'Exploration')
}

const WEAPONS: Record<string, CommanderEquipmentDefinition> = {
  wpn_m_assaultrifle_kinetic_fauto: definition('Karma AR-50', 'Kinematic Armaments', 'Rifle', 'Kinetic'),
  wpn_m_submachinegun_kinetic_fauto: definition('Karma C-44', 'Kinematic Armaments', 'Carbine', 'Kinetic'),
  wpn_s_pistol_kinetic_sauto: definition('Karma P-15', 'Kinematic Armaments', 'Pistol', 'Kinetic'),
  wpn_m_launcher_rocket_sauto: definition('Karma L-6', 'Kinematic Armaments', 'Launcher', 'Explosive'),
  wpn_m_assaultrifle_laser_fauto: definition('TK Aphelion', 'Takada', 'Rifle', 'Thermal'),
  wpn_m_submachinegun_laser_fauto: definition('TK Eclipse', 'Takada', 'Carbine', 'Thermal'),
  wpn_s_pistol_laser_sauto: definition('TK Zenith', 'Takada', 'Pistol', 'Thermal'),
  wpn_m_sniper_plasma_charged: definition('Manticore Executioner', 'Manticore', 'Long-range rifle', 'Plasma'),
  wpn_m_assaultrifle_plasma_fauto: definition('Manticore Oppressor', 'Manticore', 'Rifle', 'Plasma'),
  wpn_m_shotgun_plasma_doublebarrel: definition('Manticore Intimidator', 'Manticore', 'Shotgun', 'Plasma'),
  wpn_s_pistol_plasma_charged: definition('Manticore Tormentor', 'Manticore', 'Pistol', 'Plasma')
}

const MODIFICATIONS: Record<string, string> = {
  suit_reducedtoolbatteryconsumption: 'Reduced Tool Battery Consumption',
  suit_increasedbatterycapacity: 'Improved Battery Capacity',
  suit_increasedshieldregen: 'Faster Shield Regeneration',
  suit_improvedarmourrating: 'Damage Resistance',
  suit_increasedo2capacity: 'Increased Air Reserves',
  suit_nightvision: 'Night Vision',
  suit_improvedradar: 'Enhanced Tracking',
  suit_backpackcapacity: 'Extra Backpack Capacity',
  suit_increasedammoreserves: 'Extra Ammo Capacity',
  suit_improvedjumpassist: 'Improved Jump Assist',
  suit_increasedsprintduration: 'Increased Sprint Duration',
  suit_adsmovementspeed: 'Combat Movement Speed',
  suit_quieterfootsteps: 'Quieter Footsteps',
  suit_increasedmeleedamage: 'Added Melee Damage',
  weapon_suppression_pressurised: 'Noise Suppressor',
  weapon_suppression_unpressurised: 'Audio Masking',
  weapon_stability: 'Stability',
  weapon_handling: 'Faster Handling',
  weapon_reloadspeed: 'Reload Speed',
  weapon_clipsize: 'Magazine Size',
  weapon_scope: 'Scope',
  weapon_backpackreloading: 'Stowed Reloading',
  weapon_accuracy: 'Higher Accuracy',
  weapon_range: 'Greater Range',
  weapon_headshotdamage: 'Headshot Damage'
}

export class DefaultCommanderEquipmentCatalogue implements CommanderEquipmentCatalogue {
  public resolveModification (symbol: string): string {
    return MODIFICATIONS[normalize(symbol)] ?? humanize(symbol)
  }

  public resolveResource (symbol: string, localizedName: string | null): string {
    return usableLocalizedName(localizedName) ?? humanize(symbol)
  }

  public resolveSuit (symbol: string, localizedName: string | null): CommanderEquipmentDefinition {
    const known = SUITS[normalize(symbol).replace(/_class[1-5]$/u, '')]
    return known ?? definition(usableLocalizedName(localizedName) ?? humanize(symbol), null, null)
  }

  public resolveWeapon (symbol: string, localizedName: string | null): CommanderEquipmentDefinition {
    const known = WEAPONS[normalize(symbol)]
    return known ?? definition(usableLocalizedName(localizedName) ?? humanize(symbol), null, null)
  }
}

function definition (
  displayName: string,
  manufacturer: string | null,
  category: string | null,
  damageType: string | null = null
): CommanderEquipmentDefinition {
  return { displayName, manufacturer, category, damageType }
}

function normalize (value: string): string {
  return value.trim().replace(/^\$/u, '').replace(/_name;$/iu, '').toLowerCase()
}

function usableLocalizedName (value: string | null): string | null {
  const name = value?.trim()
  return name && !/^\$.*;$/u.test(name) ? name : null
}

function humanize (value: string): string {
  return normalize(value)
    .replace(/_class[1-5]$/u, '')
    .replace(/^wpn_[ms]_/u, '')
    .replaceAll('_', ' ')
    .replace(/([a-z])([A-Z])/gu, '$1 $2')
    .replace(/\b\w/gu, letter => letter.toUpperCase())
}
