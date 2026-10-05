import type { GameActionCategory, PhoenixControlDeckConfiguration } from '@phoenix/contracts'
import type { NavigationItem } from '@phoenix/ui'
import { CONTROL_CATEGORIES, type ControlCategory } from '../../application/navigation/phoenix-route.js'
import { phoenixRouteHash } from '../../application/navigation/phoenix-router.js'

type ControlsNavigationItem = NavigationItem & { route: { kind: 'controls', category: ControlCategory } }

const categories: Array<{ id: ControlCategory, icon: string, label: string }> = [
  { id: 'quick', icon: 'QCK', label: 'Quick access' },
  { id: 'ship', icon: 'SHP', label: 'Ship' },
  { id: 'combat', icon: 'CBT', label: 'Combat' },
  { id: 'navigation', icon: 'NAV', label: 'Navigation' },
  { id: 'vessel', icon: 'VSL', label: 'Vessel' },
  { id: 'srv', icon: 'SRV', label: 'SRV' },
  { id: 'on_foot', icon: 'OFT', label: 'On Foot' },
  { id: 'radio', icon: 'RAD', label: 'Radio' },
  { id: 'emote', icon: 'EMO', label: 'Emotes' }
]

export const controlsNavigationItems: ControlsNavigationItem[] = categories.map(category => {
  const route = { kind: 'controls' as const, category: category.id }
  return { id: category.id, label: category.label, shortLabel: category.icon, href: phoenixRouteHash(route), route }
})

export function controlsContext(category: ControlCategory): string { return category }

export function firstControlCategory(configuration?: PhoenixControlDeckConfiguration): ControlCategory {
  const context = configuration?.decks[0]?.context
  return CONTROL_CATEGORIES.find(category => context === `phoenix:${category}`) ?? 'quick'
}

export function controlsCategoryLabel(category: ControlCategory): string {
  return categories.find(candidate => candidate.id === category)?.label ?? category
}

export function gameActionCategoryLabel(category: GameActionCategory): string {
  return category === 'system' ? 'System' : category === 'misc' ? 'Miscellaneous' : controlsCategoryLabel(category)
}
