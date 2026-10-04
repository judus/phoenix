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
import { boundedLimit, json, optionalIntegerArgument, optionalStringArgument, output, ToolArgumentError } from './mcp-tools/tool-support.js'
import { DEFAULT_GALAXY_RESULT_LIMIT } from './galaxy-data-service.js'
import { ProviderQueryCache } from './provider-query-cache.js'

const CACHE_MS = 30 * 60 * 1000
// Earlier caches used unenforced numeric filters and collapsed missing signals to zero.
const CACHE_NAMESPACE = 'spansh-exploration-targets-v3'
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
  private readonly providerQueries: ProviderQueryCache

  public constructor (
    private readonly source: ExplorationTargetSearchSource,
    private readonly cartography: SystemCartography,
    private readonly runtimeState: RuntimeStateReader,
    cache: ProviderResponseCache,
    now: () => Date = () => new Date()
  ) {
    this.providerQueries = new ProviderQueryCache(cache, now)
  }

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
        ? [`Reported exploration candidates near ${result.originSystem}:`, ...result.targets.map(target => `- ${target.bodyName} (${target.systemName}, ${target.distanceLy.toFixed(1)} ly): ${target.subtype ?? target.bodyType ?? 'unknown body'}, biological signals: ${target.biologicalSignals ?? 'not reported'} / geological signals: ${target.geologicalSignals ?? 'not reported'}.`), result.caveat].join('\n')
        : `No reported exploration candidates matched near ${result.originSystem}. ${result.caveat}`,
      json(result)
    )
  }

  public async searchExplorationTargets (input: ExplorationTargetSearchInput, limit = DEFAULT_GALAXY_RESULT_LIMIT): Promise<GalaxyExplorationTargetsResponse> {
    validateRanges(input)
    const origin = await this.resolveOrigin(input.systemName)
    const { systemName: _systemName, ...providerFilters } = input
    const request: ExplorationTargetSearchRequest = { ...providerFilters, referencePosition: origin.position }
    const cached = await this.providerQueries.get(
      CACHE_NAMESPACE,
      stableKey({ ...request, systemName: origin.name }),
      CACHE_MS,
      () => this.source.findTargets(request),
      isSourceResults
    )
    const targets = cached.value
      .filter(target => meetsSignalMinimum(target.biologicalSignals, input.minBiologicalSignals)
        && meetsSignalMinimum(target.geologicalSignals, input.minGeologicalSignals))
      .filter(target => withinRange(target.surfaceTemperatureK, input.minTemperatureK, input.maxTemperatureK)
        && withinRange(target.gravityG, input.minGravityG, input.maxGravityG))
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
    if (!name) throw new ToolArgumentError('Current system is unavailable; provide systemName.', 'Provide systemName explicitly, or wait until the current system is reported.')
    return name
  }

  private async resolveOrigin (systemName: string): Promise<{ name: string, position: [number, number, number] }> {
    const requested = systemName.trim()
    const current = this.runtimeState.getCurrent().system
    if (current.name && current.position && same(current.name, requested)) return { name: current.name, position: current.position }
    const external = await this.cartography.getSystem(requested)
    if (!external.system.position) throw new ToolArgumentError('Reference system coordinates are unavailable.', 'Choose a known reference system in systemName.')
    return { name: external.system.name, position: external.system.position }
  }

}

function same (left: string, right: string): boolean { return left.trim().toLocaleLowerCase() === right.trim().toLocaleLowerCase() }
function withinRange (value: number | null, min: number | null, max: number | null): boolean {
  if (min === null && max === null) return true
  return value !== null && (min === null || value >= min) && (max === null || value <= max)
}
function stableKey (value: object): string { return JSON.stringify(Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)))) }
function isSourceResults (value: unknown): value is ExplorationTargetSearchResult[] { return Array.isArray(value) && value.every(item => GalaxyExplorationTargetSchema.safeParse(item).success) }
function meetsSignalMinimum (count: number | null, minimum: number): boolean { return minimum === 0 || (count !== null && count >= minimum) }
function boundedInteger (value: number | undefined, fallback: number, min: number, max: number): number { return value === undefined ? fallback : Math.min(Math.max(value, min), max) }
function optionalNumber (arguments_: JsonObject, key: string): number | null {
  const value = arguments_[key]
  if (value === undefined || value === null) return null
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new ToolArgumentError(`${key} must be a non-negative number.`, `Set ${key} to a finite number greater than or equal to zero, or omit it.`)
  }
  return value
}
function optionalStringArrayArgument (arguments_: JsonObject, key: string): string[] {
  const value = arguments_[key]
  if (value === undefined || value === null) return []
  if (!Array.isArray(value) || value.some(item => typeof item !== 'string' || !item.trim())) {
    throw new ToolArgumentError(`${key} must be an array of non-empty strings.`, `Provide ${key} as an array of supported Spansh names, or omit it.`)
  }
  return [...new Set(value.map(item => String(item).trim()))]
}
function optionalDateArgument (arguments_: JsonObject, key: string): string | null {
  const value = arguments_[key]
  if (value === undefined || value === null) return null
  if (typeof value !== 'string' || !validDate(value)) {
    throw new ToolArgumentError(`${key} must be a date in YYYY-MM-DD format.`, `Set ${key} to a real calendar date such as 2020-08-01, or omit it.`)
  }
  return value
}
function landableArgument (value: unknown): ExplorationLandableFilter {
  if (value === undefined || value === null) return 'any'
  if (value === 'any' || value === 'yes' || value === 'no') return value
  throw new ToolArgumentError('landable must be any, yes, or no.', 'Set landable to any, yes, or no, or omit it.')
}
function validateRanges (input: ExplorationTargetSearchInput): void {
  if (input.minGravityG !== null && input.maxGravityG !== null && input.minGravityG > input.maxGravityG) throw new ToolArgumentError('minGravityG must not exceed maxGravityG.', 'Lower minGravityG or increase maxGravityG so the minimum is no greater than the maximum.')
  if (input.minTemperatureK !== null && input.maxTemperatureK !== null && input.minTemperatureK > input.maxTemperatureK) throw new ToolArgumentError('minTemperatureK must not exceed maxTemperatureK.', 'Lower minTemperatureK or increase maxTemperatureK so the minimum is no greater than the maximum.')
  if (input.lastReportedBefore !== null && !validDate(input.lastReportedBefore)) throw new ToolArgumentError('lastReportedBefore must be a date in YYYY-MM-DD format.', 'Provide a real calendar date in YYYY-MM-DD format, or omit lastReportedBefore.')
}
function validDate (value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().startsWith(value)
}
