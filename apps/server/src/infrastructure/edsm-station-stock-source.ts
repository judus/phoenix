import type { StationStockSource, StockItem } from '../domain/station-market.js'

const DEFAULT_BASE_URL = 'https://www.edsm.net/'
const DEFAULT_TIMEOUT_MS = 10_000

export interface EdsmStationStockSourceOptions {
  baseUrl?: string
  fetch?: typeof fetch
  timeoutMs?: number
}

export class EdsmStationStockSource implements StationStockSource {
  private readonly baseUrl: URL
  private readonly fetcher: typeof fetch
  private readonly timeoutMs: number

  public constructor (options: EdsmStationStockSourceOptions = {}) {
    this.baseUrl = new URL(options.baseUrl ?? DEFAULT_BASE_URL)
    this.fetcher = options.fetch ?? globalThis.fetch
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  }

  public async getShipyard (marketId: number): Promise<StockItem[]> {
    return this.getStock('api-system-v1/stations/shipyard', 'ships', marketId)
  }

  public async getOutfitting (marketId: number): Promise<StockItem[]> {
    return this.getStock('api-system-v1/stations/outfitting', 'outfitting', marketId)
  }

  private async getStock (path: string, field: string, marketId: number): Promise<StockItem[]> {
    const url = new URL(path, this.baseUrl)
    url.searchParams.set('marketId', String(marketId))
    const response = await this.fetcher(url, {
      headers: { accept: 'application/json', 'user-agent': 'phoenix-terminal/0.1' },
      signal: AbortSignal.timeout(this.timeoutMs)
    })
    if (!response.ok) throw new Error(`EDSM ${field} request failed with HTTP ${response.status}.`)
    const payload = record(await response.json())
    const stock = payload?.[field]
    if (!Array.isArray(stock)) return []
    return stock.map(mapStockItem).filter(isPresent)
  }
}

function mapStockItem (candidate: unknown): StockItem | null {
  const raw = record(candidate)
  const name = typeof raw?.name === 'string' && raw.name.trim() ? raw.name.trim() : null
  if (!raw || !name) return null
  const id = typeof raw.id === 'string' || (typeof raw.id === 'number' && Number.isSafeInteger(raw.id))
    ? raw.id
    : null
  return { id, name }
}

function record (candidate: unknown): Record<string, unknown> | null {
  return candidate !== null && typeof candidate === 'object' && !Array.isArray(candidate)
    ? candidate as Record<string, unknown>
    : null
}

function isPresent<T> (value: T | null): value is T {
  return value !== null
}
