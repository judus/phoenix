import type { CommanderLogEntry } from '@phoenix/contracts'
import type { EliteJournalEvent } from '@phoenix/elite'
import {
  commanderLogEntry,
  detail,
  journalInteger,
  journalLabel,
  journalRecords,
  recordInteger
} from './commander-log-event.js'

export function projectFinanceCommanderLogEntry (event: EliteJournalEvent): CommanderLogEntry | null {
  switch (event.event) {
    case 'MarketBuy': return commodityTrade(event, 'trade.commodity_bought', 'Commodity bought', -1, 'TotalCost')
    case 'MarketSell': return commodityTrade(event, 'trade.commodity_sold', 'Commodity sold', 1, 'TotalSale')
    case 'RedeemVoucher': return amountEntry(event, 'finance.voucher_redeemed', 'Voucher redeemed', 1, journalLabel(event, 'Type'))
    case 'PayFines':
    case 'PayLegacyFines': return amountEntry(event, 'finance.fines_paid', 'Fines paid', -1, journalLabel(event, 'Faction'))
    case 'PayBounties': return amountEntry(event, 'finance.bounties_paid', 'Bounties paid', -1, journalLabel(event, 'Faction'))
    case 'SellExplorationData':
    case 'MultiSellExplorationData': return explorationSale(event)
    case 'SellOrganicData': return organicSale(event)
    default: return null
  }
}

function commodityTrade (
  event: EliteJournalEvent,
  kind: 'trade.commodity_bought' | 'trade.commodity_sold',
  title: string,
  direction: 1 | -1,
  amountKey: 'TotalCost' | 'TotalSale'
): CommanderLogEntry | null {
  const amount = journalInteger(event, amountKey)
  if (amount === null) return null
  const commodity = journalLabel(event, 'Type')
  const count = journalInteger(event, 'Count')
  return commanderLogEntry(event, {
    category: 'trade',
    kind,
    title,
    detail: detail(count === null ? null : `${count} units`, commodity),
    creditDelta: direction * amount,
    tone: direction > 0 ? 'positive' : 'neutral'
  })
}

function amountEntry (
  event: EliteJournalEvent,
  kind: 'finance.voucher_redeemed' | 'finance.fines_paid' | 'finance.bounties_paid',
  title: string,
  direction: 1 | -1,
  entryDetail: string | null
): CommanderLogEntry | null {
  const amount = journalInteger(event, 'Amount')
  if (amount === null) return null
  return commanderLogEntry(event, {
    category: 'finance',
    kind,
    title,
    detail: entryDetail,
    creditDelta: direction * amount,
    tone: direction > 0 ? 'positive' : 'neutral'
  })
}

function explorationSale (event: EliteJournalEvent): CommanderLogEntry | null {
  const earnings = journalInteger(event, 'TotalEarnings')
  if (earnings === null) return null
  const systems = event.event === 'MultiSellExplorationData'
    ? journalRecords(event, 'Discovered').length
    : Array.isArray(event.Systems) ? event.Systems.length : 0
  return commanderLogEntry(event, {
    category: 'finance',
    kind: 'finance.exploration_data_sold',
    title: 'Exploration data sold',
    detail: systems > 0 ? `${systems} ${systems === 1 ? 'system' : 'systems'}` : null,
    creditDelta: earnings,
    tone: 'positive'
  })
}

function organicSale (event: EliteJournalEvent): CommanderLogEntry | null {
  const records = journalRecords(event, 'BioData')
  const earnings = records.reduce<number | null>((total, record) => {
    if (total === null) return null
    const value = recordInteger(record, 'Value')
    const bonus = recordInteger(record, 'Bonus')
    return value === null && bonus === null ? null : total + (value ?? 0) + (bonus ?? 0)
  }, 0)
  if (earnings === null || records.length === 0) return null
  return commanderLogEntry(event, {
    category: 'finance',
    kind: 'finance.organic_data_sold',
    title: 'Organic data sold',
    detail: `${records.length} ${records.length === 1 ? 'sample' : 'samples'}`,
    creditDelta: earnings,
    tone: 'positive'
  })
}
