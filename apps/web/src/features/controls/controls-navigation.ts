import type { NavigationItem } from '@phoenix/ui'
import type { ControlCategory } from '../../application/navigation/phoenix-route.js'
import { phoenixRouteHash } from '../../application/navigation/phoenix-router.js'

type ControlsNavigationItem = NavigationItem & { route: { kind: 'controls', category: ControlCategory } }

const categories: Array<{ id: ControlCategory, icon: string, label: string }> = [
  { id: 'ship', icon: 'SHP', label: 'Ship' },
  { id: 'combat', icon: 'CBT', label: 'Combat' },
  { id: 'navigation', icon: 'NAV', label: 'Navigation' },
  { id: 'vessel', icon: 'VSL', label: 'Vessel' },
  { id: 'srv', icon: 'SRV', label: 'SRV' },
  { id: 'on_foot', icon: 'OFT', label: 'On Foot' },
  { id: 'radio', icon: 'RAD', label: 'Radio' },
  { id: 'emote', icon: 'EMO', label: 'Emotes' },
  { id: 'misc', icon: 'MSC', label: 'Miscellaneous' }
]

export const controlsNavigationItems: ControlsNavigationItem[] = categories.map(category => {
  const route = { kind: 'controls' as const, category: category.id }
  return { id: category.id, label: category.label, shortLabel: category.icon, href: phoenixRouteHash(route), route }
})

export function controlsContext(category: ControlCategory): string { return category }

export function controlsCategoryLabel(category: ControlCategory): string {
  return categories.find(candidate => candidate.id === category)?.label ?? category
}
