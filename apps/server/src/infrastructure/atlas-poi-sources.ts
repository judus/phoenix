import { AtlasPoiSchema, type AtlasPoi, type AtlasPoiDocument } from '@phoenix/contracts'
import type { AtlasPoiSource } from '../domain/atlas.js'

export function atlasPoiSources(request: typeof fetch = fetch): AtlasPoiSource[] {
  const sources = [
    { id: 'gec', name: 'Galactic Exploration Catalog', url: 'https://edastro.com/gec/json/all', licence: 'CC BY-NC-SA 3.0', parse: parseGec },
    ...[
      ['guardian_structures', 'Guardian Structures'],
      ['guardian_ruins', 'Guardian Ruins'],
      ['guardian_beacons', 'Guardian Beacons']
    ].map(([id, name]) => ({
      id: `canonn-${id}`, name: `Canonn · ${name}`, licence: null,
      url: `https://storage.googleapis.com/canonn-downloads/${id}.json`,
      parse: (row: Record<string, unknown>) => parseCanonn(row, id!, name!)
    }))
  ]
  return sources.map(source => ({
    ...source,
    async getPois(): Promise<AtlasPoiDocument> {
      const response = await request(source.url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(15_000) })
      if (!response.ok) throw new Error(`${source.name} request failed (${response.status}).`)
      const rows: unknown = await response.json()
      if (!Array.isArray(rows)) throw new Error(`${source.name} returned an invalid catalogue.`)
      const pois: AtlasPoi[] = []
      const ids = new Set<string>()
      let rejected = 0
      for (const row of rows) {
        const result = row && typeof row === 'object' && !Array.isArray(row)
          ? AtlasPoiSchema.safeParse(source.parse(row)) : null
        if (!result?.success || ids.has(result.data.id)) { rejected++; continue }
        pois.push(result.data)
        ids.add(result.data.id)
      }
      if (!pois.length) throw new Error(`${source.name} returned no valid POIs; retained catalogue was not replaced.`)
      return { pois, rejected }
    }
  }))
}

function parseGec(row: Record<string, unknown>) {
  return {
    id: typeof row.id === 'number' && Number.isSafeInteger(row.id) ? `gec:${row.id}` : '',
    label: row.name, systemName: row.galMapSearch, position: row.coordinates,
    categories: [row.type || 'Undefined', row.type2].filter(Boolean),
    source: 'Galactic Exploration Catalog', sourceUrl: `https://edastro.com/gec/view/${row.id}`
  }
}

function parseCanonn(row: Record<string, unknown>, dataset: string, category: string) {
  const id = row.SiteId
  const body = row['Body Name']
  const siteType = row['Site Type']
  return {
    id: typeof id === 'string' && /^\d+$/.test(id) ? `canonn:${dataset}:${id}` : '',
    label: `${category} · ${row['System Name']}${body ? ` · ${body}` : ''}`,
    systemName: row['System Name'],
    position: [coordinate(row.x), coordinate(row.y), coordinate(row.z)],
    categories: [category], source: 'Canonn Research Group',
    sourceUrl: `https://map.canonn.tech/${dataset === 'guardian_structures' ? 'gs' : dataset === 'guardian_ruins' ? 'gr' : 'gb'}-data.html`,
    ...(body ? { bodyName: body } : {}), ...(siteType ? { siteType } : {})
  }
}

function coordinate(value: unknown): number {
  if (typeof value === 'number') return value
  return typeof value === 'string' && /^-?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(value.trim())
    ? Number(value.replaceAll(',', '')) : NaN
}
