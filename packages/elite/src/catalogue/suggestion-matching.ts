import type { CatalogueSuggestion, CatalogueSuggestionKind } from '@phoenix/contracts'

export interface SuggestionEntry extends CatalogueSuggestion { aliases?: string[] }

function normalize(value: string, kind: CatalogueSuggestionKind): string {
  let result = value.toLowerCase()
  if (kind === 'module') result = result.replace(/defense/g, 'defence').replace(/optimized/g, 'optimised')
    .replace(/frame shift drive/g, 'fsd')
  if (kind !== 'commodity') result = result.replace(/\bmk\s*([ivx]+)\b/g, 'mk$1')
  return result.replace(/[^a-z0-9]+/g, ' ').trim()
}

/** Match player input; never manufacture a display name or provider value. */
export function matchCatalogueSuggestions(entries: SuggestionEntry[], kind: CatalogueSuggestionKind, query: string): CatalogueSuggestion[] {
  const prefix = kind === 'module' ? query.match(/^\s*(\d\s*[a-i])\s+/i) : null
  const search = normalize(prefix ? query.slice(prefix[0].length) : query, kind)
  const tokens = search.split(' ').filter(Boolean)
  if (tokens.join('').length < 2) return []
  const matches = entries.flatMap(entry => {
    const names = [entry.label, entry.value, ...(entry.aliases ?? [])].map(name => normalize(name, kind))
    // "Point defense turret" is a familiar description of Elite's Point Defence.
    if (kind === 'module' && names.includes('point defence')) names.push('point defence turret')
    const exact = names.includes(search)
    if (!names.some(name => tokens.every(token => name.includes(token)))) return []
    return [{ entry, rank: exact ? 0 : names.some(name => name.startsWith(search)) ? 1 : 2 }]
  })
  const seen = new Set<string>()
  return matches.sort((a, b) => a.rank - b.rank || a.entry.label.localeCompare(b.entry.label))
    .filter(({ entry }) => { if (seen.has(entry.value)) return false; seen.add(entry.value); return true })
    .slice(0, 12).map(({ entry }) => {
      const rating = prefix ? `${prefix[1]!.replace(/\s/g, '').toUpperCase()} ` : ''
      return { label: rating + entry.label, value: rating + entry.value, source: entry.source }
    })
}
