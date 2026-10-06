import type { AtlasCatalogueResponse, AtlasPoiDocument } from '@phoenix/contracts'

export interface AtlasPoiSource {
  id: string
  name: string
  url: string
  licence: string | null
  getPois(): Promise<AtlasPoiDocument>
}

export interface AtlasCatalogueReader {
  getCatalogue(): Promise<AtlasCatalogueResponse>
}
