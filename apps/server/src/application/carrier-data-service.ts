import { createHash } from 'node:crypto'
import { z } from 'zod'
import { CarrierSnapshotSchema, FleetCarrierSchema, type CarrierSnapshot, type FleetCarrier } from '@phoenix/contracts'
import type { EliteJournalEvent } from '@phoenix/elite'
import { CarrierObservationSchema, type CarrierObservation, type CarrierReader, type CarrierRepository } from '../domain/carriers.js'

const text = z.string().min(1)
const amount = z.number().finite().nonnegative()
const id = z.number().int().nonnegative()
const optionalAmount = amount.optional().nullable().transform(value => value ?? null)
const optionalText = text.optional().nullable().transform(value => value ?? null)
const finance = z.object({ CarrierBalance: amount, ReserveBalance: optionalAmount, AvailableBalance: optionalAmount, ReservePercent: optionalAmount })
const space = z.object({ TotalCapacity: amount, Crew: amount, Cargo: amount, CargoSpaceReserved: amount, ShipPacks: amount, ModulePacks: amount, FreeSpace: amount })
const crew = z.array(z.object({ CrewRole: text, CrewName: optionalText, Activated: z.boolean(), Enabled: z.boolean() }))
const location = z.object({ StarSystem: text, SystemAddress: id, Body: optionalText, BodyID: id.optional().nullable().transform(value => value ?? null) })
const payloads = {
  CarrierStats: z.object({ Callsign: text, Name: text, DockingAccess: text, AllowNotorious: z.boolean(), FuelLevel: amount, JumpRangeCurr: optionalAmount, JumpRangeMax: optionalAmount, PendingDecommission: z.boolean(), SpaceUsage: space.optional(), Finance: finance.optional(), Crew: crew.optional() }),
  CarrierBuy: z.object({ Callsign: text, Location: text, SystemAddress: id, Price: amount }),
  CarrierLocation: location,
  CarrierJump: location,
  CarrierJumpRequest: z.object({ SystemName: text, SystemAddress: id, BodyID: id, Body: optionalText, DepartureTime: z.string().datetime({ offset: true }).optional() }),
  CarrierJumpCancelled: z.object({}),
  CarrierFinance: finance,
  CarrierBankTransfer: z.object({ CarrierBalance: amount, Deposit: amount.optional(), Withdraw: amount.optional() }),
  CarrierDepositFuel: z.object({ Amount: amount, Total: amount }),
  CarrierDockingPermission: z.object({ DockingAccess: text, AllowNotorious: z.boolean() }),
  CarrierNameChange: z.object({ Callsign: text, Name: text }),
  CarrierCrewServices: z.object({ CrewRole: text, CrewName: optionalText, Operation: text }),
  CarrierDecommission: z.object({ ScrapRefund: amount, ScrapTime: amount }),
  CarrierCancelDecommission: z.object({}),
  CarrierTradeOrder: z.object({ Commodity: text, Commodity_Localised: optionalText, CancelTrade: z.boolean().optional(), Price: amount.optional(), PurchaseOrder: amount.optional(), SaleOrder: amount.optional() }),
  CarrierShipPack: z.object({ Operation: text, PackTheme: text, PackTier: id }),
  CarrierModulePack: z.object({ Operation: text, PackTheme: text, PackTier: id })
} as const

export class CarrierDataService implements CarrierReader {
  public constructor(private readonly repository: CarrierRepository) {}
  public ingest(event: EliteJournalEvent): void {
    if (!Object.hasOwn(payloads, event.event)) return
    const kind = event.event as keyof typeof payloads
    const base = z.object({ carrierId: id, timestamp: z.coerce.date(), type: optionalText }).safeParse({ carrierId: kind === 'CarrierJump' ? event.MarketID : event.CarrierID, timestamp: event.timestamp, type: event.CarrierType })
    const result = payloads[kind].safeParse(event)
    if (!base.success || !result.success) return
    const timestamp = base.data.timestamp.toISOString()
    // Parsing above establishes the individual event contract; normalization uses its validated fields.
    const value = result.data as Record<string, unknown>
    const patch: Partial<Omit<CarrierSnapshot, 'id'>> = {}
    let description: string = kind.replace(/^Carrier/, '').replace(/([a-z])([A-Z])/g, '$1 $2')
    if (kind === 'CarrierStats') {
      const stats = payloads.CarrierStats.parse(value)
      Object.assign(patch, { callsign: stats.Callsign, name: stats.Name, type: base.data.type, snapshotAt: timestamp, pendingDecommission: stats.PendingDecommission,
        fuel: { tonnes: stats.FuelLevel, currentRange: stats.JumpRangeCurr, maximumRange: stats.JumpRangeMax, observedAt: timestamp },
        access: { docking: stats.DockingAccess, notorious: stats.AllowNotorious, observedAt: timestamp },
        capacity: stats.SpaceUsage ? { total: stats.SpaceUsage.TotalCapacity, crew: stats.SpaceUsage.Crew, cargo: stats.SpaceUsage.Cargo, reservedCargo: stats.SpaceUsage.CargoSpaceReserved, shipPacks: stats.SpaceUsage.ShipPacks, modulePacks: stats.SpaceUsage.ModulePacks, free: stats.SpaceUsage.FreeSpace, observedAt: timestamp } : null,
        services: stats.Crew ? { observedAt: timestamp, changedAt: null, items: stats.Crew.map(item => ({ role: item.CrewRole, name: item.CrewName, active: item.Activated, enabled: item.Enabled })) } : null,
        finance: stats.Finance ? normalizeFinance(stats.Finance, timestamp) : null })
      description = 'Management snapshot'
    } else if (kind === 'CarrierBuy') {
      const buy = payloads.CarrierBuy.parse(value)
      Object.assign(patch, { callsign: buy.Callsign, type: base.data.type, pendingDecommission: false, location: { system: buy.Location, systemAddress: buy.SystemAddress, body: null, bodyId: null, observedAt: timestamp } })
      description = `Purchased · ${buy.Price.toLocaleString()} CR`
    } else if (kind === 'CarrierLocation' || kind === 'CarrierJump') {
      const place = location.parse(value)
      patch.location = { system: place.StarSystem, systemAddress: place.SystemAddress, body: place.Body, bodyId: place.BodyID, observedAt: timestamp }
      description = `${kind === 'CarrierJump' ? 'Arrival' : 'Location'} · ${place.StarSystem}`
    } else if (kind === 'CarrierJumpRequest') {
      const request = payloads.CarrierJumpRequest.parse(value)
      patch.jump = { system: request.SystemName, systemAddress: request.SystemAddress, body: request.Body, bodyId: request.BodyID, departureAt: request.DepartureTime ?? null, observedAt: timestamp, status: 'scheduled' }
      description = `Jump scheduled · ${request.SystemName}`
    } else if (kind === 'CarrierFinance') patch.finance = normalizeFinance(finance.parse(value), timestamp)
    else if (kind === 'CarrierBankTransfer') {
      const transfer = payloads.CarrierBankTransfer.parse(value)
      // The new balance does not establish new available/reserve balances.
      patch.finance = { balance: transfer.CarrierBalance, reserves: null, available: null, reservePercent: null, observedAt: timestamp }
      description = `Bank transfer · deposit ${transfer.Deposit?.toLocaleString() ?? '—'} CR · withdrawal ${transfer.Withdraw?.toLocaleString() ?? '—'} CR`
    } else if (kind === 'CarrierDepositFuel') {
      const fuel = payloads.CarrierDepositFuel.parse(value)
      patch.fuel = { tonnes: fuel.Total, currentRange: null, maximumRange: null, observedAt: timestamp }
      description = `Fuel deposited · ${fuel.Amount.toLocaleString()} t`
    } else if (kind === 'CarrierDockingPermission') {
      const access = payloads.CarrierDockingPermission.parse(value)
      patch.access = { docking: access.DockingAccess, notorious: access.AllowNotorious, observedAt: timestamp }
    } else if (kind === 'CarrierNameChange') {
      const name = payloads.CarrierNameChange.parse(value)
      Object.assign(patch, { callsign: name.Callsign, name: name.Name })
    } else if (kind === 'CarrierDecommission' || kind === 'CarrierCancelDecommission') patch.pendingDecommission = kind === 'CarrierDecommission'
    else if (kind === 'CarrierCrewServices') {
      const service = payloads.CarrierCrewServices.parse(value)
      description = `${service.CrewRole} · ${service.Operation}`
    } else if (kind === 'CarrierTradeOrder') {
      const trade = payloads.CarrierTradeOrder.parse(value)
      description = `${trade.CancelTrade ? 'Order cancelled' : 'Order placed'} · ${trade.Commodity_Localised ?? trade.Commodity}${trade.PurchaseOrder !== undefined ? ` · buy ${trade.PurchaseOrder.toLocaleString()}` : ''}${trade.SaleOrder !== undefined ? ` · sell ${trade.SaleOrder.toLocaleString()}` : ''}${trade.Price !== undefined ? ` · ${trade.Price.toLocaleString()} CR` : ''}`
    } else if (kind === 'CarrierShipPack' || kind === 'CarrierModulePack') description = `Sales stock · ${value.Operation} · ${value.PackTheme} tier ${value.PackTier}`
    const normalized = { carrierId: base.data.carrierId, kind, timestamp, patch, description, managementEvidence: kind === 'CarrierStats' || kind === 'CarrierBuy' }
    const entryId = createHash('sha256').update(JSON.stringify({ ...normalized, payload: result.data })).digest('hex')
    this.repository.put(CarrierObservationSchema.parse({ ...normalized, id: entryId }))
  }
  public getCarriers(): FleetCarrier[] {
    const observations = this.repository.observations()
    const managed = new Set(observations.filter(entry => entry.managementEvidence).map(entry => entry.carrierId))
    const carriers = new Map<number, CarrierSnapshot>()
    for (const entry of observations) {
      if (!managed.has(entry.carrierId)) continue
      const current = carriers.get(entry.carrierId) ?? emptyCarrier(entry.carrierId)
      applyObservation(current, entry)
      carriers.set(entry.carrierId, current)
    }
    return [...carriers.values()].map(carrier => FleetCarrierSchema.parse({ ...carrier,
      history: this.repository.history(carrier.id).map(({ id, kind, timestamp, description }) => ({ id, kind, timestamp, description }))
    })).sort((left, right) => left.id - right.id)
  }
}

function normalizeFinance(value: z.infer<typeof finance>, observedAt: string) {
  return { balance: value.CarrierBalance, reserves: value.ReserveBalance, available: value.AvailableBalance, reservePercent: value.ReservePercent, observedAt }
}
function emptyCarrier(id: number): CarrierSnapshot {
  return CarrierSnapshotSchema.parse({ id, callsign: null, name: null, type: null, snapshotAt: null, pendingDecommission: null, location: null, fuel: null, capacity: null, finance: null, access: null, services: null, jump: null })
}
function applyObservation(current: CarrierSnapshot, entry: CarrierObservation): void {
  Object.assign(current, entry.patch)
  if (entry.kind === 'CarrierJumpCancelled' && current.jump) current.jump = { ...current.jump, observedAt: entry.timestamp, status: 'cancelled' }
  if ((entry.kind === 'CarrierLocation' || entry.kind === 'CarrierJump') && current.jump?.status === 'scheduled'
    && current.jump.systemAddress === current.location?.systemAddress && current.jump.bodyId === current.location.bodyId) {
    current.jump = { ...current.jump, observedAt: entry.timestamp, status: 'arrival-observed' }
  }
  if (entry.kind === 'CarrierJump' && current.fuel) current.fuel = null // Arrival supplies no remaining tank level.
  if (entry.kind === 'CarrierCrewServices' && current.services) current.services.changedAt = entry.timestamp
}
