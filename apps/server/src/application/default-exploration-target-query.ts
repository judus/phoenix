import type { JsonObject } from '@jdu/llm-client'
import {
  GalaxyExplorationTargetSchema,
  type GalaxyExplorationTargetsResponse
} from '@phoenix/contracts'
import type { SystemCartography } from '../domain/cartography.js'
import type { ExplorationTargetSearchRequest, ExplorationTargetSearchResult, ExplorationTargetSearchSource, ExplorationLandableFilter } from '../domain/exploration-target.js'
import type { ProviderResponseCache } from '../domain/station-market.js'
import type { RuntimeStateReader } from '../domain/runtime-state.js'
import type { ExplorationTargetQuery } from './mcp-tools/tool-gateways.js'
import { boundedLimit, json, optionalIntegerArgument, optionalStringArgument, output } from './mcp-tools/tool-support.js'
import { DEFAULT_GALAXY_RESULT_LIMIT } from './galaxy-data-service.js'

const CACHE_MS = 30 * 60 * 1000
const CANDIDATE_LIMIT = 100

export interface ExplorationTargetSearchInput {
  atmospheres: string[]
  bodySubtypes: string[]
  landable: ExplorationLandableFilter
  lastReportedBefore: string | null
  maxDistanceLy: number
  maxGravityG: number | null
  maxTemperatureK: number | null
  minBiologicalSignals: number
  minGeologicalSignals: number
  minGravityG: number | null
  minTemperatureK: number | null
  systemName: string
  volcanismTypes: string[]
}

export interface ExplorationTargetReader {
  searchExplorationTargets(input: ExplorationTargetSearchInput, limit?: number): Promise<GalaxyExplorationTargetsResponse>
}

export class DefaultExplorationTargetQuery implements ExplorationTargetReader, ExplorationTargetQuery {
  private readonly inFlight = new Map<string, Promise<ExplorationTargetSearchResult[]>>()

  public constructor (
    private readonly source: ExplorationTargetSearchSource,
    private readonly cartography: SystemCartography,
    private readonly runtimeState: RuntimeStateReader,
    private readonly cache: ProviderResponseCache,
    private readonly now: () => Date = () => new Date()
  ) {}

  public async searchTargets (arguments_: JsonObject) {
    const result = await this.searchExplorationTargets({
      atmospheres: optionalStringArrayArgument(arguments_, 'atmospheres'),
      bodySubtypes: optionalStringArrayArgument(arguments_, 'bodySubtypes'),
      landable: landableArgument(arguments_.landable),
      lastReportedBefore: optionalDateArgument(arguments_, 'lastReportedBefore'),
      maxDistanceLy: boundedInteger(optionalIntegerArgument(arguments_, 'maxDistance'), 100, 1, 500),
      maxGravityG: optionalNumber(arguments_, 'maxGravityG'),
      maxTemperatureK: optionalNumber(arguments_, 'maxTemperatureK'),
      minBiologicalSignals: boundedInteger(optionalIntegerArgument(arguments_, 'minBiologicalSignals'), 0, 0, 100),
      minGeologicalSignals: boundedInteger(optionalIntegerArgument(arguments_, 'minGeologicalSignals'), 0, 0, 100),
      minGravityG: optionalNumber(arguments_, 'minGravityG'),
      minTemperatureK: optionalNumber(arguments_, 'minTemperatureK'),
      systemName: optionalStringArgument(arguments_, 'systemName') ?? this.currentSystem(),
      volcanismTypes: optionalStringArrayArgument(arguments_, 'volcanismTypes')
    }, boundedLimit(optionalIntegerArgument(arguments_, 'limit'), 10, 20))
    return output(
      result.targets.length > 0
        ? [`Reported exploration candidates near ${result.originSystem}:`, ...result.targets.map(target => `- ${target.bodyName} (${target.systemName}, ${target.distanceLy.toFixed(1)} ly): ${target.subtype ?? target.bodyType ?? 'unknown body'}, ${target.biologicalSignals} biological / ${target.geologicalSignals} geological signals.`), result.caveat].join('\n')
        : `No reported exploration candidates matched near ${result.originSystem}. ${result.caveat}`,
      json(result)
    )
  }

  public async searchExplorationTargets (input: ExplorationTargetSearchInput, limit = DEFAULT_GALAXY_RESULT_LIMIT): Promise<GalaxyExplorationTargetsResponse> {
    validateRanges(input)
    const origin = await this.resolveOrigin(input.systemName)
    const { systemName: _systemName, ...providerFilters } = input
    const request: ExplorationTargetSearchRequest = { ...providerFilters, referencePosition: origin.position }
    const cached = await this.cached(stableKey({ ...request, systemName: origin.name }), () => this.source.findTargets(request))
    const targets = cached.value
      .filter(target => target.biologicalSignals >= input.minBiologicalSignals && target.geologicalSignals >= input.minGeologicalSignals)
      .map(target => GalaxyExplorationTargetSchema.parse(target))
      .slice(0, boundedLimit(limit, DEFAULT_GALAXY_RESULT_LIMIT, DEFAULT_GALAXY_RESULT_LIMIT))
    return {
      cache: cached.cache,
      candidatesExamined: Math.min(cached.value.length, CANDIDATE_LIMIT),
      caveat: `Spansh applied the requested physical, signal, and report-date filters before returning these nearest candidates. Community reports may be incomplete, and no result proves that exploration remains unfinished.`,
      filters: providerFilters,
      originSystem: origin.name,
      provenance: 'Spansh community-reported body data',
      targets
    }
  }

  private currentSystem (): string {
    const name = this.runtimeState.getCurrent().system.name
    if (!name) throw new Error('Current system is unavailable; provide systemName.')
    return name
  }

  private async resolveOrigin (systemName: string): Promise<{ name: string, position: [number, number, number] }> {
    const requested = systemName.trim()
    const current = this.runtimeState.getCurrent().system
    if (current.name && current.position && same(current.name, requested)) return { name: current.name, position: current.position }
    const external = await this.cartography.getSystem(requested)
    if (!external.system.position) throw new Error(`Coordinates for ${requested} are unavailable.`)
    return { name: external.system.name, position: external.system.position }
  }

  private async cached (key: string, load: () => Promise<ExplorationTargetSearchResult[]>): Promise<{ cache: 'fresh' | 'refreshed' | 'stale', value: ExplorationTargetSearchResult[] }> {
    const namespace = 'spansh-exploration-targets'
    const existing = this.cache.getProviderResponse(namespace, key)
    if (existing && isSourceResults(existing.value) && this.now().getTime() - Date.parse(existing.fetchedAt) <= CACHE_MS) return { cache: 'fresh', value: existing.value }
    try {
      const active = this.inFlight.get(key)
      const value = active ?? load().then(value => {
        this.cache.putProviderResponse(namespace, key, this.now().toISOString(), value)
        return value
      }).finally(() => this.inFlight.delete(key))
      if (!active) this.inFlight.set(key, value)
      const resolved = await value
      if (!isSourceResults(resolved)) throw new Error('Invalid exploration target provider response.')
      return { cache: 'refreshed', value: resolved }
    } catch (cause) {
      if (existing && isSourceResults(existing.value)) return { cache: 'stale', value: existing.value }
      throw cause
    }
  }
}

function same (left: string, right: string): boolean { return left.trim().toLocaleLowerCase() === right.trim().toLocaleLowerCase() }
function stableKey (value: object): string { return JSON.stringify(Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)))) }
function isSourceResults (value: unknown): value is ExplorationTargetSearchResult[] { return Array.isArray(value) && value.every(item => { const candidate = item as Partial<ExplorationTargetSearchResult>; return typeof candidate.bodyName === 'string' && typeof candidate.systemName === 'string' && typeof candidate.distanceLy === 'number' && Number.isInteger(candidate.biologicalSignals) && Number.isInteger(candidate.geologicalSignals) }) }
function boundedInteger (value: number | undefined, fallback: number, min: number, max: number): number { return value === undefined ? fallback : Math.min(Math.max(value, min), max) }
function optionalNumber (arguments_: JsonObject, key: string): number | null { const value = arguments_[key]; if (value === undefined || value === null) return null; if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new Error(`${key} must be a non-negative number.`); return value }
function optionalStringArrayArgument (arguments_: JsonObject, key: string): string[] { const value = arguments_[key]; if (value === undefined || value === null) return []; if (!Array.isArray(value) || value.some(item => typeof item !== 'string' || !item.trim())) throw new Error(`${key} must be an array of non-empty strings.`); return [...new Set(value.map(item => String(item).trim()))] }
function optionalDateArgument (arguments_: JsonObject, key: string): string | null { const value = arguments_[key]; if (value === undefined || value === null) return null; if (typeof value !== 'string' || !validDate(value)) throw new Error(`${key} must be a date in YYYY-MM-DD format.`); return value }
function landableArgument (value: unknown): ExplorationLandableFilter { if (value === undefined || value === null) return 'any'; if (value === 'any' || value === 'yes' || value === 'no') return value; throw new Error('landable must be any, yes, or no.') }
function validateRanges (input: ExplorationTargetSearchInput): void {
  if (input.minGravityG !== null && input.maxGravityG !== null && input.minGravityG > input.maxGravityG) throw new Error('minGravityG must not exceed maxGravityG.')
  if (input.minTemperatureK !== null && input.maxTemperatureK !== null && input.minTemperatureK > input.maxTemperatureK) throw new Error('minTemperatureK must not exceed maxTemperatureK.')
  if (input.lastReportedBefore !== null && !validDate(input.lastReportedBefore)) throw new Error('lastReportedBefore must be a date in YYYY-MM-DD format.')
}
function validDate (value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().startsWith(value)
}
