export interface WebSearchSource {
  search(query: string, signal: AbortSignal): Promise<WebSearchResponse>
}

export interface WebSearchResponse {
  answer: string
  sources: WebSearchSourceReference[]
}

export interface WebSearchSourceReference {
  title: string
  url: string
}
