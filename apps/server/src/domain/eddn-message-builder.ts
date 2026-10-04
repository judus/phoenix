import type { EliteJournalEvent } from '@phoenix/elite'
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
  FSDJump: location, Location: { ...location, ...station }, Docked: station, Scan: scan
}

/** Explicit allowlists: an unknown future journal field cannot leak through the permissive EDDN journal schema. */
function pick (input: RecordValue, fields: Fields): RecordValue {
  const output: RecordValue = {}
  for (const [key, shape] of Object.entries(fields)) {
    const value = input[key]
    if (value === undefined) continue
    if (shape === true) {
      if (typeof value === 'string' || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))) output[key] = value
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

  public constructor (private readonly version: string) {}

  public observe (event: EliteJournalEvent): void {
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
    } else if (event.event === 'Shutdown') {
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

  public journal (event: EliteJournalEvent): EddnMessage | undefined {
    const fields = eventFields[event.event]
    if (!fields || !this.matchesSystem(event)) return undefined
    if (event.event === 'Scan' && (typeof event.BodyName !== 'string' || !event.BodyName)) return undefined
    if (event.event === 'Docked' && !stationContext(event)) return undefined
    return this.envelope('journal', {
      ...pick(event, fields), timestamp: event.timestamp, event: event.event,
      ...this.system, ...this.flags
    })
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
      if (!Array.isArray(snapshot.Items) || !snapshot.Items.every(isRecord)) return undefined
      message.commodities = snapshot.Items.filter(item =>
        !['nonmarketable', '$nonmarketable_name;'].includes(String(item.Category ?? item.categoryname).toLowerCase()) &&
        !(typeof item.legality === 'string' && item.legality.length > 0)
      ).map(item => ({
        name: typeof item.Name === 'string' ? item.Name.replace(/^\$/, '').replace(/_name;$/i, '') : undefined,
        meanPrice: item.MeanPrice, buyPrice: item.BuyPrice, stock: item.Stock, stockBracket: item.StockBracket,
        sellPrice: item.SellPrice, demand: item.Demand, demandBracket: item.DemandBracket
      }))
      return this.envelope('commodity', message)
    }
    // The schema README calls it PriceList; journal consumers also observe Pricelist.
    const items = event.event === 'Shipyard' ? snapshot.PriceList ?? snapshot.Pricelist : snapshot.Items
    if (!Array.isArray(items) || !items.every(isRecord)) return undefined
    if (event.event === 'Outfitting') {
      message.modules = [...new Set(items.filter(item => typeof item.Name === 'string' &&
        /(^hpt_|^int_|_armour_)/i.test(item.Name) && !/^int_planetapproachsuite$/i.test(item.Name) &&
        (item.sku == null || item.sku === 'ELITE_HORIZONS_V_PLANETARY_LANDINGS')
      ).map(item => item.Name))]
      return this.envelope('outfitting', message)
    }
    if (event.event === 'Shipyard') {
      message.ships = [...new Set(items.map(item => item.ShipType))]
      return this.envelope('shipyard', message)
    }
    return undefined
  }

  private matchesSystem (event: EliteJournalEvent): boolean {
    return this.system !== undefined && event.SystemAddress === this.system.SystemAddress &&
      (event.StarSystem === undefined || event.StarSystem === this.system.StarSystem)
  }

  private envelope (schema: EddnSchema, message: RecordValue): EddnMessage | undefined {
    if (!this.commander || !this.gameversion) return undefined
    return {
      $schemaRef: `https://eddn.edcd.io/schemas/${schema}/${EDDN_SCHEMA_VERSIONS[schema]}/test`,
      header: { uploaderID: this.commander, softwareName: 'PHOENIX', softwareVersion: this.version,
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
