// Interpret invariant Frontier tokens only. Unknown tokens do not imply legality or completion.
// Evidence: EDDI MissionType catalogue, d3b964ea7c8bb959ad6537f55b308f293a326905.
export function classifyMission(name: string | null): {
  onFoot: boolean
  activity: string | null
  conditions: string[]
} {
  const tokens = new Set(name?.replace(/^\$/u, '').replace(/;$/u, '').split('_') ?? [])
  const onFoot = tokens.has('OnFoot')
  const conditions: string[] = []
  if (!onFoot) return { onFoot, activity: null, conditions }
  if (tokens.has('Covert')) conditions.push('Covert')
  if (tokens.has('NCD')) conditions.push('Nonviolent')
  if (tokens.has('Legal') && !tokens.has('Illegal')) conditions.push('Legal contract')
  if (tokens.has('Illegal') && !tokens.has('Legal')) conditions.push('Illegal contract')
  const activities: ReadonlyArray<readonly [string, string]> = [
    ['RebootRestore', 'Settlement restoration'], ['Reboot', 'Settlement reactivation'],
    ['Sabotage', 'Sabotage'], ['ProductionHeist', 'Production sample retrieval'],
    ['Heist', 'Heist'], ['Download', 'Data download'], ['Upload', 'Data upload'],
    ['Assassination', 'Assassination'], ['Onslaught', 'Settlement combat'],
    ['Delivery', 'Delivery'], ['Collect', 'Collection'], ['Salvage', 'Salvage']
  ]
  return {
    onFoot,
    activity: activities.find(([token]) => tokens.has(token))?.[1] ?? null,
    conditions
  }
}
