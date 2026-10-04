import type { EliteJournalEvent } from '@phoenix/elite'
import type { EliteGameStatus } from '@phoenix/contracts'
import { EDDN_SCHEMA_VERSIONS, type EddnMessage, type EddnSchema } from './eddn.js'

type RecordValue = Record<string, unknown>
type Fields = { [key: string]: true | Fields | [Fields] }
const faction: Fields = { Name: true, FactionState: true }
const economy: Fields = { Name: true, Proportion: true }
const station: Fields = {
  MarketID: true, StationName: true, StationType: true, DistFromStarLS: true,
  StationFaction: faction, StationAllegiance: true, StationGovernment: true,
  StationEconomy: true, StationServices: true, StationState: true,
  StationEconomies: [economy], LandingPads: { Small: true, Medium: true, Large: true }
}
const location: Fields = {
  SystemAllegiance: true, SystemEconomy: true, SystemSecondEconomy: true,
  SystemFaction: faction, SystemGovernment: true, SystemSecurity: true, Population: true,
  Body: true, BodyID: true, BodyType: true, Docked: true,
  Powers: true, ControllingPower: true, PowerplayState: true,
  PowerplayStateControlProgress: true, PowerplayStateReinforcement: true, PowerplayStateUndermining: true,
  PowerplayConflictProgress: [{ Power: true, ConflictProgress: true }],
  Factions: [{ ...faction, Allegiance: true, Government: true, Happiness: true, Influence: true,
    ActiveStates: [{ State: true }], PendingStates: [{ State: true, Trend: true }],
    RecoveringStates: [{ State: true, Trend: true }] }],
  Conflicts: [{ WarType: true, Status: true,
    Faction1: { Name: true, Stake: true, WonDays: true }, Faction2: { Name: true, Stake: true, WonDays: true } }],
  ThargoidWar: { CurrentState: true, NextStateSuccess: true, NextStateFailure: true,
    SuccessStateReached: true, WarProgress: true, RemainingPorts: true, EstimatedRemainingTime: true }
}
const scan: Fields = {
  ScanType: true, BodyName: true, BodyID: true, DistanceFromArrivalLS: true,
  WasDiscovered: true, WasMapped: true,
  Parents: [{ Null: true, Star: true, Planet: true, Ring: true }],
  StarType: true, Subclass: true, StellarMass: true, Radius: true, AbsoluteMagnitude: true,
  Age_MY: true, SurfaceTemperature: true, Luminosity: true,
  RotationPeriod: true, AxialTilt: true, TidalLock: true, TerraformState: true,
  PlanetClass: true, Atmosphere: true, AtmosphereType: true,
  AtmosphereComposition: [{ Name: true, Percent: true }], Volcanism: true,
  MassEM: true, SurfaceGravity: true, SurfacePressure: true, Landable: true,
  Materials: [{ Name: true, Percent: true }], Composition: { Ice: true, Rock: true, Metal: true },
  SemiMajorAxis: true, Eccentricity: true, OrbitalInclination: true, Periapsis: true,
  OrbitalPeriod: true, AscendingNode: true, MeanAnomaly: true,
  Rings: [{ Name: true, RingClass: true, MassMT: true, InnerRad: true, OuterRad: true }], ReserveLevel: true
}
const eventFields: Record<string, Fields> = {
  FSDJump: location, Location: { ...location, ...station }, Docked: { ...station, Body: true, BodyID: true, BodyType: true }, Scan: scan,
  CarrierJump: { ...location, ...station },
  SAASignalsFound: { BodyName: true, BodyID: true, Signals: [{ Type: true, Count: true }], Genuses: [{ Genus: true }] }
}

// Per-event schemas deliberately use different system-name keys. Do not normalize them on the wire.
const dedicated: Record<string, { schema: EddnSchema, fields: Fields, system?: 'StarSystem' | 'SystemName' | 'System' }> = {
  FSSDiscoveryScan: { schema: 'fssdiscoveryscan', system: 'SystemName', fields: { BodyCount: true, NonBodyCount: true } },
  NavBeaconScan: { schema: 'navbeaconscan', system: 'StarSystem', fields: { NumBodies: true } },
  FSSAllBodiesFound: { schema: 'fssallbodiesfound', system: 'SystemName', fields: { Count: true } },
  FSSBodySignals: { schema: 'fssbodysignals', system: 'StarSystem', fields: { BodyID: true, BodyName: true, Signals: [{ Type: true, Count: true }] } },
  ScanBaryCentre: { schema: 'scanbarycentre', system: 'StarSystem', fields: {
    BodyID: true, SemiMajorAxis: true, Eccentricity: true, OrbitalInclination: true,
    Periapsis: true, OrbitalPeriod: true, AscendingNode: true, MeanAnomaly: true
  } },
  ApproachSettlement: { schema: 'approachsettlement', system: 'StarSystem', fields: {
    Name: true, MarketID: true, BodyID: true, BodyName: true, Latitude: true, Longitude: true,
    StationGovernment: true, StationAllegiance: true, StationEconomies: [economy], StationFaction: faction,
    StationServices: true, StationEconomy: true
  } },
  CodexEntry: { schema: 'codexentry', system: 'System', fields: {
    EntryID: true, Name: true, Region: true, Category: true, SubCategory: true,
    Latitude: true, Longitude: true, NearestDestination: true, VoucherAmount: true, Traits: true, BodyID: true, BodyName: true
  } },
  DockingGranted: { schema: 'dockinggranted', fields: { MarketID: true, StationName: true, StationType: true, LandingPad: true } },
  DockingDenied: { schema: 'dockingdenied', fields: { MarketID: true, StationName: true, StationType: true, Reason: true } }
}
export const EDDN_JOURNAL_EVENTS = new Set([...Object.keys(eventFields), ...Object.keys(dedicated)])
export const EDDN_SNAPSHOT_EVENTS = new Set(['Market', 'Outfitting', 'Shipyard', 'NavRoute', 'FCMaterials'])
const signalFields: Fields = {
  timestamp: true, SignalName: true, SignalType: true, IsStation: true, USSType: true,
  SpawningState: true, SpawningFaction: true, SpawningPower: true, OpposingPower: true, ThreatLevel: true
}

/** Filter before buffering so private/future fields never sit in the pending signal batch. */
export function eddnSignal (event: EliteJournalEvent): EliteJournalEvent | undefined {
  if (event.USSType === '$USS_Type_MissionTarget;') return undefined
  return { ...pick(event, signalFields), event: event.event, timestamp: event.timestamp, SystemAddress: event.SystemAddress }
}

/** Explicit allowlists: an unknown future journal field cannot leak through the permissive EDDN journal schema. */
function pick (input: RecordValue, fields: Fields): RecordValue {
  const output: RecordValue = {}
  for (const [key, shape] of Object.entries(fields)) {
    const value = input[key]
    if (value === undefined) continue
    if (shape === true) {
      if (value === null || typeof value === 'string' || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))) output[key] = value
      else if (Array.isArray(value) && value.every(item => typeof item === 'string')) output[key] = [...value]
    } else if (Array.isArray(shape)) {
      if (Array.isArray(value) && value.every(isRecord)) output[key] = value.map(item => pick(item, shape[0]))
    } else if (isRecord(value)) output[key] = pick(value, shape)
  }
  return output
}

export function isRecord (value: unknown): value is RecordValue {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

interface SystemContext { StarSystem: string, SystemAddress: number, StarPos: number[] }

export class EddnMessageBuilder {
  private commander?: string
  private gameversion = ''
  private gamebuild = ''
  private flags: Record<string, boolean> = {}
  private system?: SystemContext
  private station?: { MarketID: number, StationName: string }
  private body?: { name: string, id?: number, type?: string }
  private statusBody?: string
  private statusBoundary = 0
  private crew = false

  public constructor (private readonly version: string) {}

  public observe (event: EliteJournalEvent): void {
    if (['Fileheader', 'LoadGame', 'Shutdown', 'FSDJump', 'CarrierJump', 'Location', 'JoinACrew', 'QuitACrew'].includes(event.event) ||
      (event.event === 'Music' && event.MusicTrack === 'MainMenu')) {
      this.body = undefined
      this.statusBody = undefined
      this.statusBoundary = Date.parse(event.timestamp)
    }
    if (['Fileheader', 'LoadGame', 'QuitACrew'].includes(event.event)) this.crew = false
    if (event.event === 'JoinACrew') this.crew = true
    if (event.event === 'QuitACrew' || event.event === 'JoinACrew') {
      this.system = undefined
      this.station = undefined
    }
    if (event.event === 'ApproachBody' || event.event === 'Location') {
      const name = event.BodyName ?? event.Body
      this.body = undefined
      if ((event.event === 'Location' || this.matchesSystem(event)) && typeof name === 'string' && name) this.body = {
        name, id: Number.isSafeInteger(event.BodyID) ? event.BodyID as number : undefined,
        type: typeof event.BodyType === 'string' ? event.BodyType : event.event === 'ApproachBody' ? 'Planet' : undefined
      }
    } else if (event.event === 'LeaveBody') {
      this.body = undefined
      this.statusBody = undefined
    }
    if (event.event === 'Fileheader') {
      this.commander = undefined
      this.flags = {}
      this.system = undefined
      this.station = undefined
      this.gameversion = typeof event.gameversion === 'string' ? event.gameversion : ''
      this.gamebuild = typeof event.build === 'string' ? event.build : ''
    } else if (event.event === 'LoadGame') {
      this.commander = typeof event.Commander === 'string' && event.Commander.length > 0 ? event.Commander : undefined
      this.system = undefined
      this.station = undefined
      this.flags = {}
      if (typeof event.Horizons === 'boolean') this.flags.horizons = event.Horizons
      if (typeof event.Odyssey === 'boolean') this.flags.odyssey = event.Odyssey
      if (!this.gameversion && typeof event.gameversion === 'string') this.gameversion = event.gameversion
      if (!this.gamebuild && typeof event.build === 'string') this.gamebuild = event.build
    } else if (event.event === 'Shutdown' || (event.event === 'Music' && event.MusicTrack === 'MainMenu')) {
      this.commander = undefined
      this.system = undefined
      this.station = undefined
    } else if (['FSDJump', 'CarrierJump', 'Location'].includes(event.event)) {
      this.system = systemContext(event)
      this.station = event.Docked === true ? stationContext(event) : undefined
    } else if (event.event === 'Docked') {
      this.station = this.matchesSystem(event) ? stationContext(event) : undefined
    } else if (event.event === 'Undocked' || event.event === 'StartJump') {
      this.station = undefined
      if (event.event === 'StartJump' && event.JumpType === 'Hyperspace') this.system = undefined
    }
  }

  public observeStatus (status: Pick<EliteGameStatus, 'timestamp' | 'bodyName'>): void {
    if (Date.parse(status.timestamp) >= this.statusBoundary) this.statusBody = status.bodyName ?? undefined
  }

  public canContribute (): boolean { return !!this.commander && !this.crew }

  public journal (event: EliteJournalEvent): EddnMessage | undefined {
    const definition = dedicated[event.event]
    if (definition) {
      const message: RecordValue = { ...pick(event, definition.fields), timestamp: event.timestamp, event: event.event, ...this.flags }
      if (definition.system) {
        if (!this.matchesSystem(event)) return undefined
        Object.assign(message, { [definition.system]: this.system!.StarSystem, SystemAddress: this.system!.SystemAddress, StarPos: this.system!.StarPos })
      }
      if (event.event === 'CodexEntry') {
        // Modern journals supply BodyID directly. Only infer a missing ID with both sources agreeing.
        if (this.statusBody && message.BodyName === undefined &&
          (message.BodyID === undefined || (this.body?.name === this.statusBody && this.body.id === message.BodyID))) message.BodyName = this.statusBody
        if (message.BodyID === undefined && this.statusBody === this.body?.name && this.body?.id !== undefined) message.BodyID = this.body.id
        for (const key of ['Name', 'Region', 'Category', 'SubCategory']) if (message[key] === '') delete message[key]
      }
      return this.envelope(definition.schema, message)
    }
    const fields = eventFields[event.event]
    if (!fields || !this.matchesSystem(event)) return undefined
    if (event.event === 'Scan' && (typeof event.BodyName !== 'string' || !event.BodyName)) return undefined
    if (event.event === 'Docked' && !stationContext(event)) return undefined
    const body = event.event === 'Docked' && this.body?.type === 'Planet' ? { Body: this.body.name, BodyType: 'Planet' } : {}
    return this.envelope('journal', {
      ...body,
      ...pick(event, fields), timestamp: event.timestamp, event: event.event,
      ...this.system, ...this.flags
    })
  }

  public signals (events: EliteJournalEvent[]): EddnMessage | undefined {
    const signals = events.filter(event => this.matchesSystem(event) && event.USSType !== '$USS_Type_MissionTarget;')
      .map(event => pick(event, signalFields))
    if (!signals.length) return undefined
    return this.envelope('fsssignaldiscovered', {
      event: 'FSSSignalDiscovered', timestamp: signals[0].timestamp, ...this.system, ...this.flags, signals
    })
  }

  public snapshot (event: EliteJournalEvent, snapshot: RecordValue): EddnMessage | undefined {
    if (snapshot.event !== event.event || snapshot.timestamp !== event.timestamp) return undefined
    if (event.event === 'NavRoute') {
      if (!Array.isArray(snapshot.Route) || !snapshot.Route.every(isRecord)) return undefined
      const Route = snapshot.Route.map(item => ({ ...pick(item, { StarSystem: true, SystemAddress: true, StarClass: true }),
        StarPos: Array.isArray(item.StarPos) ? [...item.StarPos] : undefined }))
      return this.envelope('navroute', { event: event.event, timestamp: event.timestamp, ...this.flags, Route })
    }
    if (event.event === 'FCMaterials') {
      if (!Number.isSafeInteger(event.MarketID) || snapshot.MarketID !== event.MarketID ||
        snapshot.CarrierID !== event.CarrierID || snapshot.CarrierName !== event.CarrierName) return undefined
      return this.envelope('fcmaterials_journal', {
        ...pick(snapshot, { MarketID: true, CarrierName: true, CarrierID: true, Items: [{ id: true, Name: true, Price: true, Stock: true, Demand: true }] }),
        event: event.event, timestamp: event.timestamp, ...this.flags
      })
    }
    return this.stock(event, snapshot)
  }

  public stock (event: EliteJournalEvent, snapshot: RecordValue): EddnMessage | undefined {
    if (!this.system || !this.station || event.MarketID !== this.station.MarketID ||
      snapshot.MarketID !== event.MarketID || snapshot.timestamp !== event.timestamp || snapshot.event !== event.event ||
      snapshot.StarSystem !== this.system.StarSystem || snapshot.StationName !== this.station.StationName) return undefined
    const message: RecordValue = {
      systemName: this.system.StarSystem, stationName: this.station.StationName,
      marketId: this.station.MarketID, timestamp: snapshot.timestamp, ...this.flags
    }
    if (event.event === 'Market') {
      if (typeof snapshot.StationType === 'string') message.stationType = snapshot.StationType
      if (typeof snapshot.CarrierDockingAccess === 'string') message.carrierDockingAccess = snapshot.CarrierDockingAccess
      if (!Array.isArray(snapshot.Items) || !snapshot.Items.every(isRecord)) return undefined
      message.commodities = snapshot.Items.filter(item =>
        !['nonmarketable', '$nonmarketable_name;'].includes(String(item.Category ?? item.categoryname).toLowerCase()) &&
        !(typeof item.legality === 'string' && item.legality.length > 0)
      ).map(item => ({
        name: typeof item.Name === 'string' ? item.Name.replace(/^\$/, '').replace(/_name;$/i, '') : undefined,
        meanPrice: item.MeanPrice, buyPrice: item.BuyPrice, stock: item.Stock, stockBracket: item.StockBracket,
        sellPrice: item.SellPrice, demand: item.Demand, demandBracket: item.DemandBracket
      })).sort((a, b) => String(a.name).localeCompare(String(b.name)))
      return this.envelope('commodity', message)
    }
    // The schema README calls it PriceList; journal consumers also observe Pricelist.
    const items = event.event === 'Shipyard' ? snapshot.PriceList ?? snapshot.Pricelist : snapshot.Items
    if (!Array.isArray(items) || !items.every(isRecord)) return undefined
    // These files describe the stock's entitlement, which can differ from the running session.
    if (typeof snapshot.Horizons === 'boolean') message.horizons = snapshot.Horizons
    else delete message.horizons
    if (event.event === 'Outfitting') {
      message.modules = [...new Set(items.filter(item => typeof item.Name === 'string' &&
        /(^hpt_|^int_|_armour_)/i.test(item.Name) && !/^int_planetapproachsuite$/i.test(item.Name) &&
        (item.sku == null || item.sku === 'ELITE_HORIZONS_V_PLANETARY_LANDINGS')
      ).map(item => (item.Name as string).replace(/^hpt_|^int_|armour_/ig, prefix => prefix[0].toUpperCase() + prefix.slice(1).toLowerCase())))].sort()
      return this.envelope('outfitting', message)
    }
    if (event.event === 'Shipyard') {
      message.ships = [...new Set(items.map(item => item.ShipType))].sort()
      return this.envelope('shipyard', message)
    }
    return undefined
  }

  private matchesSystem (event: EliteJournalEvent): boolean {
    return this.system !== undefined && event.SystemAddress === this.system.SystemAddress &&
      [event.StarSystem, event.SystemName, event.System].every(name => name === undefined || name === this.system!.StarSystem)
  }

  private envelope (schema: EddnSchema, message: RecordValue): EddnMessage | undefined {
    if (!this.canContribute() || !this.gameversion) return undefined
    return {
      $schemaRef: `https://eddn.edcd.io/schemas/${schema}/${EDDN_SCHEMA_VERSIONS[schema]}/test`,
      header: { uploaderID: this.commander!, softwareName: 'PHOENIX', softwareVersion: this.version,
        gameversion: this.gameversion, gamebuild: this.gamebuild }, message
    }
  }
}

function systemContext (event: EliteJournalEvent): SystemContext | undefined {
  if (typeof event.StarSystem !== 'string' || !event.StarSystem || !Number.isSafeInteger(event.SystemAddress) ||
    !Array.isArray(event.StarPos) || event.StarPos.length !== 3 || !event.StarPos.every(value => typeof value === 'number' && Number.isFinite(value))) return undefined
  return { StarSystem: event.StarSystem, SystemAddress: event.SystemAddress as number, StarPos: [...event.StarPos] }
}

function stationContext (event: EliteJournalEvent): { MarketID: number, StationName: string } | undefined {
  return Number.isSafeInteger(event.MarketID) && typeof event.StationName === 'string' && event.StationName.length > 0
    ? { MarketID: event.MarketID as number, StationName: event.StationName } : undefined
}
