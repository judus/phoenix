import type { ActivityLogEntry, NavigationRoute, RuntimeState } from '@phoenix/contracts'

export interface DashboardViewModel {
  activity: readonly {
    event: string
    id: string
    source: string
    timestamp: string
    time: string
  }[]
  commander: {
    credits: string | null
    legalState: string | null
    name: string
    notoriety: {
      label: string
      value: number
    } | null
  }
  route: {
    current: string
    destination: string
    detail: string
  }
  ship: {
    cargo: string
    hull: string
    identifier: string
    jumpRange: string
    name: string
  }
  situation: {
    allegiance: string
    economy: string
    place: string
    population: string
    security: string
    system: string
  }
  warnings: readonly string[]
}

export function createDashboardViewModel(
  runtime: RuntimeState | undefined,
  route: NavigationRoute | undefined,
  activity: readonly ActivityLogEntry[],
  locale?: string
): DashboardViewModel {
  const notoriety = runtime?.commander.statistics?.groups.Crime?.Notoriety ?? null
  const system = runtime?.system.name ?? 'Unknown system'
  const place = runtime?.location.place?.name ?? locationLabel(runtime)
  const cargo = runtime?.inventory.cargo?.items.reduce((total, item) => total + item.count, 0)
  const shipName = runtime?.ship.name ?? runtime?.ship.definition?.displayName ?? runtime?.ship.typeId
  const routeSummary = summarizeRoute(route, runtime?.system.name)

  return {
    activity: activity
      .filter(entry => entry.importance !== 'trace')
      .slice(0, 5)
      .map(entry => ({
        event: humanize(entry.event),
        id: entry.id,
        source: humanize(entry.source),
        timestamp: entry.timestamp,
        time: formatTime(entry.timestamp, locale)
      })),
    commander: {
      credits: formatCredits(runtime?.gameStatus?.balance, locale),
      legalState: runtime?.gameStatus?.legalState ? humanize(runtime.gameStatus.legalState) : null,
      name: runtime?.commander.name ?? 'Identity pending',
      notoriety: notoriety === null ? null : {
        label: formatNumber(notoriety, locale) ?? 'Not reported',
        value: notoriety
      }
    },
    route: {
      current: runtime?.system.name ?? 'Current system unknown',
      destination: routeSummary.destination,
      detail: routeSummary.detail
    },
    ship: {
      cargo: cargo === undefined ? '—' : `${cargo} / ${formatNumber(runtime?.ship.cargoCapacity, locale) ?? '—'}`,
      hull: formatPercent(runtime?.ship.hullHealth),
      identifier: runtime?.ship.identifier ?? runtime?.ship.definition?.displayName ?? 'Loadout pending',
      jumpRange: runtime?.ship.maxJumpRange == null ? '—' : `${runtime.ship.maxJumpRange.toFixed(1)} ly`,
      name: shipName ?? 'No ship identified'
    },
    situation: {
      allegiance: runtime?.system.allegiance ?? '—',
      economy: runtime?.system.primaryEconomy?.label ?? '—',
      place,
      population: formatNumber(runtime?.system.population, locale) ?? '—',
      security: runtime?.system.security?.label ?? '—',
      system
    },
    warnings: situationWarnings(runtime)
  }
}

function situationWarnings(state?: RuntimeState): string[] {
  if (!state?.gameStatus) return []
  const warnings: string[] = []
  const { flags, flags2 } = state.gameStatus
  if (flags.inDanger) warnings.push('Ship telemetry reports immediate danger.')
  if (flags.beingInterdicted) warnings.push('Interdiction in progress.')
  if (flags.overheating) warnings.push('Ship temperature is critical.')
  if (flags.lowFuel) warnings.push('Main fuel level is low.')
  if (flags2.lowHealth) warnings.push('Commander health is low.')
  if (flags2.lowOxygen) warnings.push('Suit oxygen is low.')
  if (state.ship.hullHealth !== null && state.ship.hullHealth < 0.5) {
    warnings.push(`Hull integrity at ${formatPercent(state.ship.hullHealth)}.`)
  }
  return warnings
}

function summarizeRoute(route: NavigationRoute | undefined, currentSystem?: string | null) {
  const hops = route?.route ?? []
  if (hops.length === 0) return { destination: 'No route plotted', detail: 'Navigation computer idle' }
  const currentIndex = currentSystem ? hops.findIndex(hop => hop.system === currentSystem) : -1
  const remaining = Math.max(0, hops.length - Math.max(currentIndex, 0) - 1)
  return {
    destination: hops.at(-1)?.system ?? 'Unknown destination',
    detail: `${remaining} ${remaining === 1 ? 'jump' : 'jumps'} remaining`
  }
}

function locationLabel(state?: RuntimeState): string {
  if (!state) return 'Establishing telemetry link'
  return humanize(state.location.state)
}

function formatPercent(value?: number | null): string {
  return value == null ? '—' : `${Math.round(value * 100)}%`
}

function formatNumber(value?: number | null, locale?: string): string | undefined {
  return value == null ? undefined : new Intl.NumberFormat(locale).format(value)
}

function formatCredits(value?: number | null, locale?: string): string | null {
  return value == null ? null : `${new Intl.NumberFormat(locale).format(Math.round(value))} CR`
}

function formatTime(timestamp: string, locale?: string): string {
  return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(new Date(timestamp))
}

function humanize(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/gu, '$1 $2')
    .replace(/[._-]+/gu, ' ')
    .replace(/\b\w/gu, letter => letter.toUpperCase())
}
