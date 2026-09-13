import type { DashboardMarketSignalsResponse, GalaxyQueryParameterValue } from '@phoenix/contracts'
import type { RuntimeStateReader } from '../domain/runtime-state.js'
import type { SavedGalaxyQueries } from '../domain/saved-galaxy-queries.js'
import type { MarketSignalReader } from './market-signal-service.js'

export interface DashboardMarketSignalReader {
  getDashboardMarketSignals(): Promise<DashboardMarketSignalsResponse>
}

export class DashboardMarketSignalService implements DashboardMarketSignalReader {
  public constructor (
    private readonly savedQueries: SavedGalaxyQueries,
    private readonly marketSignals: MarketSignalReader,
    private readonly runtimeState: RuntimeStateReader
  ) {}

  public async getDashboardMarketSignals (): Promise<DashboardMarketSignalsResponse> {
    const query = this.savedQueries.getDashboardQuery('market-signals')
    if (!query) return { configuration: null, result: null, schemaVersion: 1, state: 'not-configured' }
    const configuration = { id: query.id, name: query.name }
    const systemName = this.runtimeState.getCurrent().system.name?.trim()
    if (!systemName) return { configuration, result: null, schemaVersion: 1, state: 'location-unknown' }
    const parameters = query.parameters
    return {
      configuration,
      result: await this.marketSignals.searchMarketSignals({
        includeFleetCarriers: scalar(parameters.fleetCarriers) === 'yes',
        maxDaysAgo: integer(parameters.maxDaysAgo, 3),
        minDeviationPercent: numberValue(parameters.minDeviationPercent, 20),
        minimumPadSize: padSize(scalar(parameters.pad)),
        minVolume: integer(parameters.minVolume, 100),
        sides: signalSides(parameters.sides),
        systemName
      }, 5),
      schemaVersion: 1,
      state: 'ready'
    }
  }
}

function scalar(value: GalaxyQueryParameterValue | undefined): string {
  return typeof value === 'string' ? value : ''
}

function numberValue(value: GalaxyQueryParameterValue | undefined, fallback: number): number {
  const parsed = Number(scalar(value))
  return Number.isFinite(parsed) ? parsed : fallback
}

function integer(value: GalaxyQueryParameterValue | undefined, fallback: number): number {
  return Math.trunc(numberValue(value, fallback))
}

function padSize(value: string): number | null {
  return { any: null, large: 3, medium: 2, small: 1 }[value] ?? null
}

function signalSides(value: GalaxyQueryParameterValue | undefined): Array<'buy' | 'sell'> {
  if (!Array.isArray(value)) return ['buy', 'sell']
  const selected = value.filter((side): side is 'buy' | 'sell' => side === 'buy' || side === 'sell')
  return selected.length > 0 ? selected : ['buy', 'sell']
}
