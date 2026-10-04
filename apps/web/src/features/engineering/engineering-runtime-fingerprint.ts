import type { RuntimeState } from '@phoenix/contracts'
import type { EngineeringRoute } from './use-engineering-controller.js'

// Keep aligned with EngineeringDataService and the project material watchlist.
// SSE reconstructs objects, and equal timestamps can contain changed counts: neither
// reference identity nor updatedAt alone is a safe refresh dependency.
export function engineeringRuntimeFingerprint(route: EngineeringRoute, state: RuntimeState): string {
  const { materials } = state.inventory
  switch (route.view) {
    case 'project-new': return ''
    case 'engineers': return JSON.stringify([state.commander.engineers, state.system.position])
    case 'projects':
    case 'project-detail':
    case 'experimental-effects':
    case 'materials-xeno':
      return JSON.stringify(materials)
    case 'materials-raw':
    case 'materials-manufactured':
    case 'materials-encoded': {
      const category = route.view.slice('materials-'.length) as 'raw' | 'manufactured' | 'encoded'
      return JSON.stringify([materials?.updatedAt ?? null, materials?.[category] ?? null])
    }
    case 'blueprints':
      if (!route.selectedBlueprintSymbol) return JSON.stringify(state.ship.modules)
      // Detail includes applied-module labels/effects, costs, unlocks and distance.
    case 'project-add-blueprint':
      return JSON.stringify([state.ship.modules, materials, state.commander.engineers, state.system.position])
  }
}
