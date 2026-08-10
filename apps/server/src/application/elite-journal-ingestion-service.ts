import { randomUUID } from 'node:crypto'
import type { GameEventEnvelope, RuntimeLocationState } from '@phoenix/contracts'
import type { EliteJournalEvent } from '@phoenix/elite'
import type { GameEventIngestor } from '../domain/runtime-state.js'

type EventCandidate = Omit<GameEventEnvelope, 'id' | 'ingestedAt' | 'schemaVersion' | 'source'>

export class EliteJournalIngestionService {
  public constructor (private readonly events: GameEventIngestor) {}

  public ingest (event: EliteJournalEvent): GameEventEnvelope[] {
    const ingestedAt = new Date().toISOString()
    return this.map(event).map(candidate => this.events.ingest({
      ...candidate,
      schemaVersion: 1,
      id: randomUUID(),
      ingestedAt,
      source: 'journal'
    } as GameEventEnvelope))
  }

  private map (event: EliteJournalEvent): EventCandidate[] {
    const gameTimestamp = event.timestamp
    const candidates: EventCandidate[] = []

    if (event.event === 'Commander') {
      const name = stringValue(event, 'Name')
      if (name) candidates.push({ type: 'commander.identity_changed', gameTimestamp, payload: { name } })
    }

    if (event.event === 'Rank') {
      candidates.push({
        type: 'commander.ranks_changed',
        gameTimestamp,
        payload: rankValues(event)
      })
    }

    if (event.event === 'Progress') {
      candidates.push({
        type: 'commander.rank_progress_changed',
        gameTimestamp,
        payload: rankValues(event)
      })
    }

    const location = mapLocation(event)
    if (location) candidates.push({ type: 'location.changed', gameTimestamp, payload: location })

    if (event.event === 'Loadout') {
      const type = stringValue(event, 'Ship')
      if (type) {
        candidates.push({
          type: 'ship.identity_changed',
          gameTimestamp,
          payload: {
            type,
            name: stringValue(event, 'ShipName')
          }
        })
      }
    }

    return candidates
  }
}

function mapLocation (event: EliteJournalEvent): {
  state: RuntimeLocationState
  systemName: string | null
  placeName: string | null
} | null {
  const systemName = stringValue(event, 'StarSystem')
  const bodyName = stringValue(event, 'Body') ?? stringValue(event, 'BodyName')
  const stationName = stringValue(event, 'StationName')

  switch (event.event) {
    case 'Location':
      return {
        state: event.Docked === true ? 'docked' : 'unknown',
        systemName,
        placeName: stationName ?? bodyName
      }
    case 'FSDJump':
    case 'CarrierJump':
      return { state: 'in_space', systemName, placeName: bodyName }
    case 'Docked':
      return { state: 'docked', systemName, placeName: stationName }
    case 'Undocked':
      return { state: 'in_space', systemName, placeName: null }
    case 'SupercruiseEntry':
      return { state: 'supercruise', systemName, placeName: null }
    case 'SupercruiseExit':
      return { state: 'in_space', systemName, placeName: bodyName }
    case 'Touchdown':
      return { state: 'landed', systemName, placeName: bodyName }
    case 'Liftoff':
      return { state: 'in_space', systemName, placeName: bodyName }
    case 'Disembark':
      return { state: 'on_foot', systemName, placeName: stationName ?? bodyName }
    case 'Embark':
      return {
        state: event.SRV === true ? 'in_srv' : 'in_space',
        systemName,
        placeName: stationName ?? bodyName
      }
    case 'StartJump':
      if (event.JumpType === 'Hyperspace') {
        return { state: 'hyperspace', systemName, placeName: null }
      }
      if (event.JumpType === 'Supercruise') {
        return { state: 'supercruise', systemName, placeName: null }
      }
      return null
    default:
      return null
  }
}

function rankValues (event: EliteJournalEvent) {
  return {
    combat: integerValue(event, 'Combat'),
    trade: integerValue(event, 'Trade'),
    exploration: integerValue(event, 'Explore'),
    federation: integerValue(event, 'Federation'),
    empire: integerValue(event, 'Empire'),
    cqc: integerValue(event, 'CQC'),
    mercenary: integerValue(event, 'Soldier'),
    exobiologist: integerValue(event, 'Exobiologist')
  }
}

function stringValue (event: EliteJournalEvent, key: string): string | null {
  const value = event[key]
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

function integerValue (event: EliteJournalEvent, key: string): number | null {
  const value = event[key]
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null
}
