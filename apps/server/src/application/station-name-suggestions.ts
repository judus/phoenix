/** Suggestions only: never use approximate matches to resolve a station automatically. */
export function stationNameSuggestions(query: string, names: readonly string[]): string[] {
  const needle = normalize(query)
  if (needle.length < 3) return []
  return [...new Set(names)].map(name => {
    const candidate = normalize(name)
    if (candidate === needle) return { name, score: 0 }
    if (candidate.startsWith(needle)) return { name, score: 1 }
    if (candidate.includes(needle)) return { name, score: 2 }
    const threshold = needle.length >= 8 ? 2 : needle.length >= 5 ? 1 : 0
    if (Math.abs(candidate.length - needle.length) > threshold) return { name, score: Infinity }
    const distance = editDistance(needle, candidate)
    return { name, score: distance <= threshold ? 3 + distance : Infinity }
  }).filter(match => Number.isFinite(match.score))
    .sort((left, right) => left.score - right.score || left.name.localeCompare(right.name))
    .slice(0, 5).map(match => match.name)
}

function normalize(value: string): string {
  return value.normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
}

function editDistance(left: string, right: string): number {
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index)
  for (let row = 1; row <= left.length; row++) {
    const current = [row]
    for (let column = 1; column <= right.length; column++) {
      current[column] = Math.min(current[column - 1]! + 1, previous[column]! + 1, previous[column - 1]! + (left[row - 1] === right[column - 1] ? 0 : 1))
    }
    previous = current
  }
  return previous[right.length]!
}
