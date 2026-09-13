import type { CommanderLogEntry } from '@phoenix/contracts'
import type { EliteJournalEvent } from '@phoenix/elite'
import {
  commanderLogEntry,
  detail,
  journalInteger,
  journalText
} from './commander-log-event.js'

export type ShipDisplayNameResolver = (identifier: string) => string | null

export function projectFleetCommanderLogEntry (
  event: EliteJournalEvent,
  resolveShipDisplayName: ShipDisplayNameResolver
): CommanderLogEntry | null {
  switch (event.event) {
    case 'ShipyardBuy': return shipBought(event, resolveShipDisplayName)
    case 'ShipyardSell': return shipSold(event, resolveShipDisplayName)
    case 'ShipyardTransfer': return shipTransferred(event, resolveShipDisplayName)
    case 'Died': return shipDestroyed(event)
    default: return null
  }
}

function shipBought (event: EliteJournalEvent, resolve: ShipDisplayNameResolver): CommanderLogEntry | null {
  const price = journalInteger(event, 'ShipPrice')
  if (price === null) return null
  const soldFor = journalInteger(event, 'SellPrice') ?? 0
  return commanderLogEntry(event, {
    category: 'fleet',
    kind: 'fleet.ship_bought',
    title: 'Ship purchased',
    detail: detail(shipName(event, resolve), journalText(event, 'SellOldShip') ? 'Previous ship sold' : null),
    creditDelta: soldFor - price,
    tone: 'positive'
  })
}

function shipSold (event: EliteJournalEvent, resolve: ShipDisplayNameResolver): CommanderLogEntry | null {
  const price = journalInteger(event, 'ShipPrice')
  if (price === null) return null
  return commanderLogEntry(event, {
    category: 'fleet',
    kind: 'fleet.ship_sold',
    title: 'Ship sold',
    detail: shipName(event, resolve),
    creditDelta: price,
    tone: 'neutral'
  })
}

function shipTransferred (event: EliteJournalEvent, resolve: ShipDisplayNameResolver): CommanderLogEntry | null {
  const price = journalInteger(event, 'TransferPrice')
  if (price === null) return null
  return commanderLogEntry(event, {
    category: 'fleet',
    kind: 'fleet.ship_transfer_requested',
    title: 'Ship transfer requested',
    detail: detail(shipName(event, resolve), journalText(event, 'System')),
    creditDelta: -price,
    tone: 'neutral'
  })
}

function shipDestroyed (event: EliteJournalEvent): CommanderLogEntry {
  return commanderLogEntry(event, {
    category: 'fleet',
    kind: 'fleet.ship_destroyed',
    title: 'Ship destroyed',
    detail: detail(journalText(event, 'KillerName'), journalText(event, 'KillerShip')),
    creditDelta: null,
    tone: 'warning'
  })
}

function shipName (event: EliteJournalEvent, resolve: ShipDisplayNameResolver): string | null {
  const identifier = journalText(event, 'ShipType')
  return journalText(event, 'ShipType_Localised') ?? (identifier ? resolve(identifier) ?? identifier : null)
}
