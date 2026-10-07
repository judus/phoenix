/** Match presentation-only differences, then return the original article passage. */
export function createGalnetQuoteResolver(title: string, body: string): (quote: string) => string | undefined {
  const sources = [title, body].map(source => {
    let text = ''
    const spans: { start: number, end: number }[] = []
    for (const match of source.matchAll(/\s+|[^\s]/gu)) {
      const normalized = normalize(match[0])
      text += normalized
      for (let index = 0; index < normalized.length; index++) {
        spans.push({ start: match.index, end: match.index + match[0].length })
      }
    }
    return { source, text, spans }
  })
  return quote => {
    const normalized = normalize(quote).trim()
    if (!normalized) return undefined
    for (const { source } of sources) if (source.includes(quote)) return quote
    for (const { source, text, spans } of sources) {
      const start = text.indexOf(normalized)
      if (start !== -1) return source.slice(spans[start]!.start, spans[start + normalized.length - 1]!.end)
    }
    return undefined
  }
}

function normalize(text: string): string {
  return text.replace(/\s+/gu, ' ').replace(/[\u2018\u2019]/gu, "'").replace(/[\u201c\u201d]/gu, '"')
}
