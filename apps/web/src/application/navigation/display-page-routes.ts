import type { DisplayCommand, DisplayPageId } from '@phoenix/contracts'
import type { PhoenixRoute } from './phoenix-route.js'

const DISPLAY_PAGE_ROUTES = {
  'commander.dashboard': { kind: 'information', section: 'commander', view: 'dashboard' },
  'commander.career': { kind: 'information', section: 'commander', view: 'career' },
  'commander.statistics': { kind: 'information', section: 'commander', view: 'statistics' },
  'commander.inventory': { kind: 'information', section: 'commander', view: 'inventory' },
  'commander.loadouts': { kind: 'information', section: 'commander', view: 'loadouts' },
  'equipment.gear': { kind: 'information', section: 'equipment', view: 'gear' },
  'equipment.upgrades': { kind: 'information', section: 'equipment', view: 'upgrades' },
  'equipment.specialists': { kind: 'information', section: 'equipment', view: 'specialists' },
  'equipment.planner': { kind: 'information', section: 'equipment', view: 'planner' },
  'equipment.materials': { kind: 'information', section: 'equipment', view: 'materials' },
  'fleet.current': { kind: 'information', section: 'fleet', view: 'current-overview' },
  'fleet.loadout': { kind: 'information', section: 'fleet', view: 'current-loadout' },
  'fleet.cargo': { kind: 'information', section: 'fleet', view: 'current-cargo' },
  'fleet.engineering': { kind: 'information', section: 'fleet', view: 'current-engineering' },
  'fleet.overview': { kind: 'information', section: 'fleet', view: 'overview' },
  'fleet.carriers': { kind: 'information', section: 'fleet', view: 'carriers' },
  'fleet.stored-modules': { kind: 'information', section: 'fleet', view: 'stored-modules' },
  'fleet.catalogue': { kind: 'information', section: 'fleet', view: 'catalogue' },
  'galaxy.system': { kind: 'information', section: 'galaxy', view: 'system' },
  'galaxy.atlas': { kind: 'information', section: 'galaxy', view: 'atlas' },
  'galaxy.route': { kind: 'information', section: 'galaxy', view: 'route' },
  'activities.exobiology': { kind: 'information', section: 'activities', view: 'exobiology' },
  'galaxy.database': { kind: 'information', section: 'galaxy', view: 'database' },
  'activities.missions': { kind: 'information', section: 'activities', view: 'missions' },
  'activities.community-goals': { kind: 'information', section: 'activities', view: 'community-goals' },
  'activities.powerplay': { kind: 'information', section: 'activities', view: 'powerplay' },
  'activities.colonisation': { kind: 'information', section: 'activities', view: 'colonisation' },
  'engineering.blueprints': { kind: 'information', section: 'engineering', view: 'blueprints' },
  'engineering.projects': { kind: 'information', section: 'engineering', view: 'projects' },
  'engineering.engineers': { kind: 'information', section: 'engineering', view: 'engineers' },
  'engineering.materials-raw': { kind: 'information', section: 'engineering', view: 'materials-raw' },
  'engineering.materials-manufactured': { kind: 'information', section: 'engineering', view: 'materials-manufactured' },
  'engineering.materials-encoded': { kind: 'information', section: 'engineering', view: 'materials-encoded' },
  'engineering.materials-xeno': { kind: 'information', section: 'engineering', view: 'materials-xeno' },
  'comms.inbox': { kind: 'information', section: 'comms', view: 'inbox' },
  'comms.traffic': { kind: 'information', section: 'comms', view: 'traffic' },
  'comms.contacts': { kind: 'information', section: 'comms', view: 'contacts' },
  'comms.galnet': { kind: 'information', section: 'comms', view: 'galnet' },
  'comms.radio': { kind: 'information', section: 'comms', view: 'radio' },
  'controls.ship': { kind: 'controls', deckId: 'ship' },
  'controls.combat': { kind: 'controls', deckId: 'combat' },
  'controls.navigation': { kind: 'controls', deckId: 'navigation' },
  'controls.vessel': { kind: 'controls', deckId: 'vessel' },
  'controls.srv': { kind: 'controls', deckId: 'srv' },
  'controls.on-foot': { kind: 'controls', deckId: 'on_foot' },
  'controls.radio': { kind: 'controls', deckId: 'radio' },
  'controls.emote': { kind: 'controls', deckId: 'emote' },
  'copilot.chat': { kind: 'copilot', view: 'chat' },
  'copilot.profiles': { kind: 'copilot', view: 'profiles' },
  numpad: { kind: 'numpad' },
  macros: { kind: 'macros' },
  journal: { kind: 'journal', view: 'commander' },
  credits: { kind: 'journal', view: 'credits' },
  notes: { kind: 'notes' },
  settings: { kind: 'settings', view: 'general' },
  help: { kind: 'settings', view: 'help' },
  'developer.overview': { kind: 'developer', view: 'tools' },
  'developer.runtime': { kind: 'developer', view: 'tools' },
  'developer.elite': { kind: 'developer', view: 'tools' },
  'developer.health': { kind: 'developer', view: 'tools' },
  'developer.tests': { kind: 'developer', view: 'tools' },
  'developer.controls': { kind: 'developer', view: 'tools' }
} as const satisfies Record<DisplayPageId, PhoenixRoute>

export function routeForDisplayPage (pageId: DisplayPageId): PhoenixRoute {
  return DISPLAY_PAGE_ROUTES[pageId]
}

export function routeForDisplayCommand (command: DisplayCommand): PhoenixRoute {
  if (command.type === 'open_page') return routeForDisplayPage(command.pageId)
  if (command.type === 'show_atlas') return {
    kind: 'information', section: 'galaxy', view: 'atlas', location: command.location, displayRequestId: command.id
  }
  return {
    kind: 'information',
    section: 'galaxy',
    view: 'system',
    systemName: command.systemName,
    ...(command.selectedName ? { selectedName: command.selectedName } : {})
  }
}
