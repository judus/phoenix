export * from './actions.js'
export * from './bookmarks.js'
export * from './cartography.js'
export * from './commands.js'
export * from './commander-log.js'
export * from './commander-equipment.js'
export * from './communications.js'
export * from './control-deck-layout-presets.js'
export * from './display.js'
export * from './fleet.js'
export * from './copilot.js'
export * from './elite-catalogue.js'
export * from './elite-file-sources.js'
export * from './elite-inventory.js'
export * from './elite-journal.js'
export * from './elite-status.js'
export * from './engineering.js'
export * from './exploration.js'
export * from './galaxy.js'
export * from './galnet.js'
export * from './macros.js'
export * from './missions.js'
export * from './numpad.js'
export * from './pairing.js'
export * from './personal-materials.js'
export * from './personal-equipment-upgrades.js'
export * from './personal-equipment-specialists.js'
export * from './runtime.js'
export * from './saved-galaxy-queries.js'
export * from './settings.js'

export const PHOENIX_API_VERSION = '1' as const

export interface DatabaseHealth {
  connected: boolean
  engine: 'sqlite'
}

export interface HealthResponse {
  apiVersion: typeof PHOENIX_API_VERSION
  database: DatabaseHealth
  name: 'PHOENIX'
  status: 'ok'
  timestamp: string
}
