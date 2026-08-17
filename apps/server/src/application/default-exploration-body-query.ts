import type { JsonObject } from '@jdu/llm-client'
import type { CartographicBody } from '@phoenix/contracts'
import type {
  CartographyObservationStore,
  LocalBodyCartographyObservation,
  SystemCartography
} from '../domain/cartography.js'
import type { RuntimeStateReader } from '../domain/runtime-state.js'
import type { ExplorationBodyQuery } from './mcp-tools/tool-gateways.js'
import { json, output } from './mcp-tools/tool-support.js'

export class DefaultExplorationBodyQuery implements ExplorationBodyQuery {
  public constructor (
    private readonly observations: CartographyObservationStore,
    private readonly cartography: SystemCartography,
    private readonly runtimeState: RuntimeStateReader
  ) {}

  public async getCurrentBody (_arguments: JsonObject) {
    const state = this.runtimeState.getCurrent()
    const systemName = state.system.name
    const runtimeBody = state.location.place?.kind === 'body' ? state.location.place : null
    const bodyName = runtimeBody?.name ?? state.gameStatus?.bodyName
    if (!systemName || !bodyName) {
      return output('No current or nearby body is known from local telemetry.', { currentBody: null })
    }

    const observation = this.observations.getObservation(systemName)
    const local = observation?.bodies.find(body => (
      sameName(body.bodyName, bodyName) ||
      (runtimeBody?.id !== null && runtimeBody?.id !== undefined && body.bodyId === runtimeBody.id)
    )) ?? null
    const external = await this.externalBody(systemName, bodyName, runtimeBody?.id ?? local?.bodyId ?? null)
    const scan = local?.scan ?? {}
    const signals = signalCounts(local)
    const genuses = biologicalGenuses(local)
    const samples = biologicalSamples(local, genuses)
    const geological = geologicalSignals(local, scan, signals.geological)
    const currentBody = {
      name: external?.name ?? local?.bodyName ?? bodyName,
      system: systemName,
      systemAddress: observation?.systemAddress ?? state.system.address,
      bodyId: runtimeBody?.id ?? local?.bodyId ?? external?.bodyId ?? null,
      status: bodyStatus(state.location.state),
      latitude: state.gameStatus?.latitude ?? null,
      longitude: state.gameStatus?.longitude ?? null,
      discovered: knownBoolean(local?.discovered),
      mapped: knownBoolean(local ? local.surfaceScanCompleted || local.mapped === true : null),
      footfalled: knownBoolean(local?.footfalled),
      planetClass: stringField(scan.PlanetClass) ?? external?.subType ?? 'Unknown',
      atmosphere: stringField(scan.Atmosphere) ?? stringField(scan.AtmosphereType) ?? 'Unknown',
      volcanism: stringField(scan.Volcanism) ?? 'Unknown'
    }
    const summary = [
      `Body: ${currentBody.name} (${systemName}); ${currentBody.status}`,
      `Discovery: ${currentBody.discovered}; mapped: ${currentBody.mapped}; footfall: ${currentBody.footfalled}`,
      `Signals: biological ${signals.biological}; geological ${signals.geological}; human ${signals.human}`,
      samples.length > 0
        ? `Biological samples:\n${samples.map(sample => `- ${sampleLabel(sample)}: ${sample.completed ? 'complete' : `${sample.progress}/3 samples`}`).join('\n')}`
        : 'Biological samples: none recorded.',
      geological.length > 0
        ? `Geological signals:\n${geological.map(signal => `- ${signal.type}: ${signal.count}; ${signal.status}`).join('\n')}`
        : 'Geological signals: none recorded.'
    ].join('\n')

    return output(summary, json({
      currentBody,
      signalCounts: signals,
      biologicalSignals: genuses,
      geologicalSignals: geological,
      samples,
      localHistoryComplete: false
    }))
  }

  private async externalBody (systemName: string, bodyName: string, bodyId: number | null): Promise<CartographicBody | null> {
    try {
      const system = (await this.cartography.getSystem(systemName)).system
      return system.bodies.find(body => (
        sameName(body.name, bodyName) || (bodyId !== null && body.bodyId === bodyId)
      )) ?? null
    } catch {
      return null
    }
  }
}

interface BiologicalSignal {
  genus: string | null
  name: string
}

interface BiologicalSample {
  completed: boolean
  genus: string
  lastUpdated: string | null
  progress: number
  scanTypes: string[]
  species: string
  variant: string
}

function biologicalGenuses (body: LocalBodyCartographyObservation | null): BiologicalSignal[] {
  const raw = body?.surfaceSignals?.Genuses
  if (Array.isArray(raw)) {
    const genuses = raw.map(item => {
      if (!isRecord(item)) return null
      const genus = stringField(item.Genus)
      const name = stringField(item.Genus_Localised) ?? genus
      return name ? { genus, name } : null
    }).filter((item): item is BiologicalSignal => item !== null)
    if (genuses.length > 0) return genuses
  }
  const count = signalCounts(body).biological
  return count > 0 ? [{ genus: null, name: 'Unknown' }] : []
}

function biologicalSamples (
  body: LocalBodyCartographyObservation | null,
  genuses: BiologicalSignal[]
): BiologicalSample[] {
  const samples: BiologicalSample[] = (body?.organicSamples ?? []).map(sample => ({
    completed: sample.completed,
    genus: sample.genus,
    lastUpdated: sample.lastUpdated,
    progress: sample.progress,
    scanTypes: sample.scanTypes,
    species: sample.species,
    variant: sample.variant
  }))
  for (const signal of genuses) {
    if (samples.some(sample => sameName(sample.genus, signal.name))) continue
    samples.push({
      completed: false,
      genus: signal.name,
      lastUpdated: null,
      progress: 0,
      scanTypes: [],
      species: 'Unknown',
      variant: 'Unknown'
    })
  }
  return samples.sort((left, right) => (
    Number(left.completed) - Number(right.completed) || left.genus.localeCompare(right.genus)
  ))
}

function geologicalSignals (
  body: LocalBodyCartographyObservation | null,
  scan: Record<string, unknown>,
  count: number
) {
  const volcanism = stringField(scan.Volcanism)
  if (count === 0 && !volcanism) return []
  return [{
    type: volcanism ?? 'Geological',
    count,
    status: body?.surfaceScanCompleted ? 'surface mapped' : count > 0 ? 'detected' : 'known from scan'
  }]
}

function signalCounts (body: LocalBodyCartographyObservation | null) {
  const source = body?.surfaceSignals ?? body?.bodySignals
  const counts = { biological: 0, geological: 0, human: 0 }
  const signals = source?.Signals
  if (!Array.isArray(signals)) return counts
  for (const item of signals) {
    if (!isRecord(item)) continue
    const type = stringField(item.Type)?.toLocaleLowerCase() ?? ''
    const count = integerField(item.Count) ?? 0
    if (type.includes('biological')) counts.biological = count
    if (type.includes('geological')) counts.geological = count
    if (type.includes('human')) counts.human = count
  }
  return counts
}

function bodyStatus (state: ReturnType<RuntimeStateReader['getCurrent']>['location']['state']): string {
  if (state === 'on_foot' || state === 'in_suit') return 'on foot'
  if (state === 'in_srv') return 'in SRV'
  if (state === 'landed') return 'landed'
  if (state === 'in_space' || state === 'supercruise') return 'near body'
  return 'last known'
}

function sampleLabel (sample: BiologicalSample): string {
  return [sample.genus, sample.species, sample.variant].filter(value => value !== 'Unknown').join(' / ') || 'Unknown biological signal'
}

function knownBoolean (value: boolean | null | undefined): 'Yes' | 'No' | 'Unknown' {
  return value === true ? 'Yes' : value === false ? 'No' : 'Unknown'
}

function sameName (left: string, right: string): boolean {
  return left.toLocaleLowerCase() === right.toLocaleLowerCase()
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
