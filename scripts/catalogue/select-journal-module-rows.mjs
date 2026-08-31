export function selectJournalModuleRows (rows) {
  const selected = new Map()
  for (const row of rows) {
    const symbol = String(row.symbol ?? '').trim()
    if (!symbol) throw new Error('FDevIDs outfitting row is missing its journal symbol.')
    const key = symbol.toLowerCase()
    const existing = selected.get(key)
    if (!existing) {
      selected.set(key, row)
      continue
    }

    const existingVariant = isMercGear(existing)
    const incomingVariant = isMercGear(row)
    if (existingVariant && !incomingVariant) selected.set(key, row)
    else if (!existingVariant && incomingVariant) continue
    else throw new Error(`FDevIDs contains ambiguous canonical rows for journal module ${symbol}.`)
  }
  return [...selected.values()]
}

function isMercGear (row) {
  return String(row.category ?? '').trim().toLowerCase() === 'mercgear'
}
