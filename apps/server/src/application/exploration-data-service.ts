import {
  ExplorationLedgerResponseSchema,
  type ExplorationBodyRecord,
  type ExplorationLedgerResponse,
  type ExplorationSystemRecord
} from '@phoenix/contracts'
import type {
  CartographyObservationStore,
  LocalBodyCartographyObservation,
  LocalSystemCartographyObservation
} from '../domain/cartography.js'
import type {
  BiologicalCompletionOverride,
  BiologicalCompletionOverrideRepository
} from '../domain/exploration.js'

export interface ExplorationDataReader {
  getLedger(): ExplorationLedgerResponse
  setBiologicalSignalManualCompletion(bodyKey: string, signalKey: string, completed: boolean): boolean
}

export class ExplorationDataService implements ExplorationDataReader {
  public constructor (
    private readonly observations: CartographyObservationStore,
    private readonly overrides: BiologicalCompletionOverrideRepository
  ) {}

  public getLedger (): ExplorationLedgerResponse {
    const manualCompletions = this.overrides.listBiologicalCompletionOverrides()
    const systems = this.observations.listObservations()
      .map(observation => systemRecord(observation, manualCompletions))
    const bodies = systems.flatMap(system => system.bodies)
    return ExplorationLedgerResponseSchema.parse({
      systems,
      totals: {
        systems: systems.length,
        bodies: bodies.length,
        scannedBodies: bodies.filter(body => body.scanned).length,
        mappedBodies: bodies.filter(body => body.surfaceScanCompleted).length,
        biologicalSignals: bodies.reduce((total, body) => total + body.signals.biological, 0),
        geologicalSignals: bodies.reduce((total, body) => total + body.signals.geological, 0),
        samplesCompleted: bodies.reduce((total, body) => total + completedBiologicalSignals(body), 0)
      }
    })
  }

  public setBiologicalSignalManualCompletion (bodyKey: string, signalKey: string, completed: boolean): boolean {
    const body = this.getLedger().systems.flatMap(system => system.bodies)
      .find(candidate => candidate.key === bodyKey)
    if (!body || !biologicalSignalKeys(body).has(signalKey)) return false
    this.overrides.setBiologicalCompletionOverride(bodyKey, signalKey, completed)
    return true
  }
}

function systemRecord (
  observation: LocalSystemCartographyObservation,
  overrides: BiologicalCompletionOverride[]
): ExplorationSystemRecord {
  return {
    name: observation.systemName,
    address: observation.systemAddress,
    allBodiesFound: observation.allBodiesFound === true,
    updatedAt: observation.updatedAt,
    reportedBodyCount: observation.reportedBodyCount,
    bodies: observation.bodies
      .map(body => bodyRecord(observation, body, overrides))
      .sort((left, right) => bodyOrder(left, right))
  }
}

function bodyRecord (
  system: LocalSystemCartographyObservation,
  body: LocalBodyCartographyObservation,
  overrides: BiologicalCompletionOverride[]
): ExplorationBodyRecord {
  const scan = body.scan ?? {}
  const key = `${system.systemAddress ?? normalize(system.systemName)}:${body.bodyId ?? normalize(body.bodyName)}`
  return {
    key,
    systemName: system.systemName,
    systemAddress: system.systemAddress,
    bodyId: body.bodyId,
    name: body.bodyName,
    observedAt: body.observedAt,
    discovered: body.discovered,
    mapped: body.mapped,
    footfalled: body.footfalled ?? null,
    surfaceScanCompleted: body.surfaceScanCompleted,
    scanned: body.scan !== null,
    planetClass: stringField(scan.PlanetClass),
    atmosphere: stringField(scan.Atmosphere) ?? stringField(scan.AtmosphereType),
    volcanism: stringField(scan.Volcanism),
    signals: signalCounts(body),
    biologicalGenuses: biologicalGenuses(body),
    biologicalSignals: biologicalSignals(body),
    manualBiologicalCompletions: overrides
      .filter(override => override.bodyKey === key)
      .map(override => ({ completedAt: override.completedAt, signalKey: override.signalKey })),
    organicSamples: (body.organicSamples ?? []).map(sample => ({
      completed: sample.completed,
      genus: sample.genus,
      lastUpdated: sample.lastUpdated,
      progress: sample.progress,
      scanTypes: sample.scanTypes,
      species: sample.species,
      variant: sample.variant
    }))
  }
}

function signalCounts (body: LocalBodyCartographyObservation) {
  const signals = (body.surfaceSignals ?? body.bodySignals)?.Signals
  const counts = { biological: 0, geological: 0, human: 0 }
  if (!Array.isArray(signals)) return counts
  for (const candidate of signals) {
    if (!isRecord(candidate)) continue
    const type = stringField(candidate.Type)?.toLocaleLowerCase() ?? ''
    const count = integerField(candidate.Count) ?? 0
    if (type.includes('biological')) counts.biological = count
    if (type.includes('geological')) counts.geological = count
    if (type.includes('human')) counts.human = count
  }
  return counts
}

function biologicalGenuses (body: LocalBodyCartographyObservation): string[] {
  const genuses = body.surfaceSignals?.Genuses
  if (!Array.isArray(genuses)) return []
  return [...new Set(genuses.flatMap(candidate => {
    if (!isRecord(candidate)) return []
    const name = stringField(candidate.Genus_Localised) ?? stringField(candidate.Genus)
    return name ? [name] : []
  }))]
}

function biologicalSignals (body: LocalBodyCartographyObservation): Array<{ key: string, name: string }> {
  const genuses = body.surfaceSignals?.Genuses
  if (!Array.isArray(genuses)) return []
  const signals = genuses.flatMap(candidate => {
    if (!isRecord(candidate)) return []
    const key = stringField(candidate.Genus) ?? stringField(candidate.Genus_Localised)
    const name = stringField(candidate.Genus_Localised) ?? key
    return key && name ? [{ key, name }] : []
  })
  return [...new Map(signals.map(signal => [signal.key, signal])).values()]
}

function biologicalSignalKeys (body: ExplorationBodyRecord): Set<string> {
  const keys = body.biologicalSignals.map(signal => signal.key)
  if (keys.length === 0) {
    keys.push(...body.organicSamples.map(sample => sample.genus))
    for (let index = keys.length; index < body.signals.biological; index += 1) {
      keys.push(`biological-signal-${index}`)
    }
  }
  return new Set(keys)
}

function completedBiologicalSignals (body: ExplorationBodyRecord): number {
  const completed = new Set<string>()
  for (const signal of body.biologicalSignals) {
    if (body.organicSamples.some(sample => sample.completed && sameSignal(sample.genus, signal.name))) {
      completed.add(signal.key)
    }
  }
  if (body.biologicalSignals.length === 0) {
    for (const sample of body.organicSamples.filter(sample => sample.completed)) completed.add(sample.genus)
  }
  for (const override of body.manualBiologicalCompletions) completed.add(override.signalKey)
  return Math.min(completed.size, Math.max(body.signals.biological, biologicalSignalKeys(body).size))
}

function sameSignal (left: string, right: string): boolean {
  return left.toLocaleLowerCase() === right.toLocaleLowerCase()
}

function bodyOrder (left: ExplorationBodyRecord, right: ExplorationBodyRecord): number {
  if (left.bodyId !== null && right.bodyId !== null) return left.bodyId - right.bodyId
  return left.name.localeCompare(right.name)
}

function normalize (value: string): string {
  return value.trim().toLocaleLowerCase().replace(/\s+/gu, '-')
}

function stringField (candidate: unknown): string | null {
  return typeof candidate === 'string' && candidate.trim() ? candidate.trim() : null
}

function integerField (candidate: unknown): number | null {
  return typeof candidate === 'number' && Number.isSafeInteger(candidate) && candidate >= 0 ? candidate : null
}

function isRecord (candidate: unknown): candidate is Record<string, unknown> {
  return candidate !== null && typeof candidate === 'object' && !Array.isArray(candidate)
}
