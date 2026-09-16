import type {
  CommandDescriptor,
  CommandTarget,
  CopilotCapabilityCatalogue,
  CopilotPermissionPolicy,
  CopilotProfileCapabilitySettings
} from '@phoenix/contracts'

export const COPILOT_CONTROL_TOOL_NAMES = [
  'controls.find_actions',
  'controls.execute_command',
  'controls.set_control_state'
] as const

export const DEFAULT_COPILOT_FIXED_TOOL_NAMES = [
  'commander.get_current_situation',
  'equipment.get_equipment_report',
  'engineering.list_engineers',
  'engineering.list_material_inventory',
  'comms.list_messages',
  'display.open_page',
  'display.show_body_details',
  'display.show_system_schematic',
  'exploration.get_current_body_signals',
  'exploration.find_exploration_targets',
  'factions.find_faction_presence',
  'fleet.list_owned_ships',
  'fleet.list_stored_modules',
  'navigation.check_jump_reachability',
  'navigation.get_plotted_route',
  'missions.list_missions',
  'stations.find_stations_selling_module',
  'markets.find_commodity_markets',
  'markets.find_trade_opportunities',
  'ship.get_cargo_manifest',
  'ship.get_current_ship_status',
  'ship.list_installed_modules',
  'ships.compare_ship_definitions',
  'stations.find_shipyards_selling_ship',
  'ships.get_ship_definition',
  'stations.find_nearest_service',
  'stations.get_station_details',
  'stations.list_shipyard_stock',
  'stations.find_stations_by_name',
  'stations.list_outfitting_stock',
  'systems.get_system_details',
  'systems.find_systems',
  'web.search_web'
] as const

export const DEFAULT_COPILOT_ENABLED_CAPABILITY_IDS = DEFAULT_COPILOT_FIXED_TOOL_NAMES
  .map(toolCapabilityId)

const COPILOT_CAPABILITY_ID_V1_TO_V2: Readonly<Record<string, string>> = {
  'tool:commander.get_current_state': 'tool:commander.get_current_situation',
  'tool:commander.get_inventory': 'tool:equipment.get_equipment_report',
  'tool:commander.list_engineers': 'tool:engineering.list_engineers',
  'tool:commander.list_materials': 'tool:engineering.list_material_inventory',
  'tool:controls.execute': 'tool:controls.execute_command',
  'tool:controls.set_switch': 'tool:controls.set_control_state',
  'tool:display.show_body': 'tool:display.show_body_details',
  'tool:display.show_system': 'tool:display.show_system_schematic',
  'tool:exploration.get_current_body': 'tool:exploration.get_current_body_signals',
  'tool:exploration.search_targets': 'tool:exploration.find_exploration_targets',
  'tool:factions.search': 'tool:factions.find_faction_presence',
  'tool:fleet.list_ships': 'tool:fleet.list_owned_ships',
  'tool:markets.find_best_trade': 'tool:markets.find_commodity_markets',
  'tool:navigation.can_jump_to': 'tool:navigation.check_jump_reachability',
  'tool:navigation.get_route': 'tool:navigation.get_plotted_route',
  'tool:operations.list_missions': 'tool:missions.list_missions',
  'tool:outfitting.find_module': 'tool:stations.find_stations_selling_module',
  'tool:ship.get_cargo': 'tool:ship.get_cargo_manifest',
  'tool:ship.get_status': 'tool:ship.get_current_ship_status',
  'tool:ship.list_modules': 'tool:ship.list_installed_modules',
  'tool:ships.compare': 'tool:ships.compare_ship_definitions',
  'tool:ships.find_shipyards': 'tool:stations.find_shipyards_selling_ship',
  'tool:ships.get_definition': 'tool:ships.get_ship_definition',
  'tool:stations.find_nearest': 'tool:stations.find_nearest_service',
  'tool:stations.get_details': 'tool:stations.get_station_details',
  'tool:stations.lookup': 'tool:stations.find_stations_by_name',
  'tool:stations.search_outfitting': 'tool:stations.list_outfitting_stock',
  'tool:systems.get_details': 'tool:systems.get_system_details',
  'tool:systems.search': 'tool:systems.find_systems',
  'tool:web.search': 'tool:web.search_web'
}

export function migrateCopilotCapabilityIdsV1 (ids: readonly string[]): string[] {
  return [...new Set(ids.map(id => COPILOT_CAPABILITY_ID_V1_TO_V2[id] ?? id))]
}

export interface CopilotCapabilities {
  catalogue(policy?: CopilotPermissionPolicy): CopilotCapabilityCatalogue
  normalizePolicy(policy: CopilotPermissionPolicy, ceiling?: CopilotPermissionPolicy): CopilotPermissionPolicy
  profilePolicy(profileId: string): CopilotPermissionPolicy
  profileSettings(profileId: string): CopilotProfileCapabilitySettings
  saveInstallationPolicy(policy: CopilotPermissionPolicy): CopilotPermissionPolicy
  saveProfilePolicy(profileId: string, policy: CopilotPermissionPolicy): CopilotProfileCapabilitySettings
  isCommandEnabled(target: CommandTarget): boolean
  isDescriptorEnabled(descriptor: CommandDescriptor): boolean
  isToolEnabled(name: string): boolean
}

export function toolCapabilityId (name: string): string {
  return `tool:${name}`
}
