import type { GalnetArticle, GalnetNewsResponse } from '@phoenix/contracts'

export interface GalnetSource {
  getLatest(limit: number): Promise<GalnetArticle[]>
}

export interface GalnetNewsReader {
  getLatest(limit?: number): Promise<GalnetNewsResponse>
}
