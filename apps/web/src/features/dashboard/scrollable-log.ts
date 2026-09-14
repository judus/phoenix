export function bottomAlignedRowTailSpace(
  viewportHeight: number,
  rowBounds: readonly { start: number, end: number }[]
): number {
  const firstRow = rowBounds[0]
  const lastRow = rowBounds.at(-1)
  if (viewportHeight <= 0 || !firstRow || !lastRow) return 0
  if (lastRow.end - firstRow.start <= viewportHeight) return 0

  let visibleStart = lastRow.end
  for (let index = rowBounds.length - 1; index >= 0; index--) {
    const row = rowBounds[index]!
    if (lastRow.end - row.start > viewportHeight) break
    visibleStart = row.start
  }

  const visibleHeight = lastRow.end - visibleStart
  return visibleHeight === 0 ? 0 : viewportHeight - visibleHeight
}
