import type { Mission } from '@phoenix/contracts'

export function missionContextDetails(mission: Mission): string[] {
  const details: string[] = []
  const { briefing } = mission
  if (briefing.onFoot) {
    details.push(`on-foot activity: ${briefing.activity ?? 'unknown'}`)
    details.push(`known contract conditions: ${briefing.conditions.join(', ') || 'not observed'}`)
  }
  if (mission.target) details.push(`target: ${mission.target}`)
  if (mission.targetType) details.push(`target type: ${mission.targetType}`)
  if (mission.targetFaction) details.push(`target faction: ${mission.targetFaction}`)
  if (mission.commodity) details.push(`required item: ${mission.commodity}${mission.commodityCount === null ? '' : ` × ${mission.commodityCount}`}`)
  if (mission.killCount !== null) details.push(`required kills: ${mission.killCount} (not observed kills)`)
  if (mission.progress.required !== null) {
    details.push(`${mission.progress.delivered ?? 'unknown'}/${mission.progress.required} delivered`)
  }
  for (const item of briefing.inventory.items) {
    details.push(`observed item: ${item.label ?? item.id} × ${item.count} in ${item.store}, at ${item.observedAt} (possession is not objective completion)`)
  }
  if (briefing.onFoot) {
    details.push(`inventory snapshots: backpack ${briefing.inventory.backpackAt ?? 'not observed'}, ship locker ${briefing.inventory.shipLockerAt ?? 'not observed'}`)
  }
  if (mission.reward !== null) details.push(`expected credits: ${mission.reward}`)
  const received = mission.receivedRewards
  if (received && received.credits !== null) {
    details.push(`received credits: ${received.credits}`)
  }
  for (const item of mission.receivedRewards?.materials ?? []) {
    details.push(`received material: ${item.label ?? item.id} × ${item.count}`)
  }
  return details
}
