export function formatCommunityGoalExpiry(value: string): string {
  // Preserve Frontier's wall-clock fields: no source timezone was supplied.
  return `${Number(value.slice(0, 4)) + 1286}${value.slice(4, 16)}`
}
