import type {
  GameActionCatalogResponse,
  MacroDefinition,
  MacroRisk
} from '@phoenix/contracts'

const RISK_ORDER: readonly MacroRisk[] = ['safe', 'caution', 'dangerous', 'destructive']

export function withEffectiveMacroRisk (
  macro: MacroDefinition,
  catalog: GameActionCatalogResponse
): MacroDefinition {
  return { ...macro, risk: effectiveMacroRisk(macro, catalog) }
}

export function effectiveMacroRisk (
  macro: MacroDefinition,
  catalog: GameActionCatalogResponse
): MacroRisk {
  const actionRisks = new Map(catalog.actions.map(action => [
    action.definition.id,
    action.definition.risk === 'routine' ? 'safe' as const : action.definition.risk
  ]))
  return macro.steps.reduce<MacroRisk>((risk, step) => (
    step.type === 'game-action'
      ? maximumRisk(risk, actionRisks.get(step.actionId) ?? 'safe')
      : risk
  ), macro.risk)
}

export function isDangerousMacroAction (
  actionId: string,
  catalog: GameActionCatalogResponse
): boolean {
  return catalog.actions.some(action => (
    action.definition.id === actionId && action.definition.risk === 'dangerous'
  ))
}

function maximumRisk (left: MacroRisk, right: MacroRisk): MacroRisk {
  return RISK_ORDER[Math.max(RISK_ORDER.indexOf(left), RISK_ORDER.indexOf(right))]!
}
