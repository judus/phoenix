import type { GameActionCategory, PhoenixControlDeckConfiguration } from '@phoenix/contracts'
import type { NavigationItem } from '@phoenix/ui'
import type { ControlDeckId } from '../../application/navigation/phoenix-route.js'
import { phoenixRouteHash } from '../../application/navigation/phoenix-router.js'

type ControlsNavigationItem = NavigationItem & { route: { kind: 'controls', deckId: ControlDeckId } }

const categories: Array<{ id: GameActionCategory | 'quick', icon: string, label: string }> = [
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

export function controlsNavigationItems(configuration?: PhoenixControlDeckConfiguration): ControlsNavigationItem[] {
  return (configuration?.decks ?? []).map(deck => {
    const label = configuration?.groups?.find(group => group.id === deck.groupId)?.name ?? deck.name
    const route = { kind: 'controls' as const, deckId: deck.id }
    const shortLabel = categories.find(category => category.label === label)?.icon ?? label.replace(/\s/gu, '').slice(0, 3).toUpperCase()
    return { id: deck.id, label, shortLabel, href: phoenixRouteHash(route), route }
  })
}

export function controlsContext(deckId: ControlDeckId): string { return deckId }

export function firstControlDeckId(configuration?: PhoenixControlDeckConfiguration): ControlDeckId {
  return configuration?.decks[0]?.id ?? 'quick'
}

export function resolveControlsDestination(route: { kind: 'controls', deckId: string }, configuration?: PhoenixControlDeckConfiguration) {
  return !configuration || route.deckId === 'manage' || configuration.decks.some(deck => deck.id === route.deckId)
    ? route : { kind: 'controls' as const, deckId: firstControlDeckId(configuration) }
}

export function controlsCategoryLabel(category: GameActionCategory | 'quick'): string {
  return categories.find(candidate => candidate.id === category)?.label ?? category
}

export function gameActionCategoryLabel(category: GameActionCategory): string {
  return category === 'system' ? 'System' : category === 'misc' ? 'Miscellaneous' : controlsCategoryLabel(category)
}
