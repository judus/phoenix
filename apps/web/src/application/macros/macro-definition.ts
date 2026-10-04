import type { MacroDefinition, MacroRecording } from '@phoenix/contracts'

export function macroDefinitionFromRecording(name: string, recording: MacroRecording): MacroDefinition {
  const entries = recording.entries.filter(entry => successfulRecording(entry.status))
  const steps: MacroDefinition['steps'] = []

  entries.forEach((entry, index) => {
    if (index > 0 && entry.delayBeforeMs > 0) {
      steps.push({ type: 'wait', durationMs: Math.min(entry.delayBeforeMs, 30_000) })
    }
    steps.push({ type: 'game-action', actionId: entry.actionId, operation: entry.operation })
  })

  return {
    assumptions: [],
    description: '',
    enabled: true,
    id: `macro-${recording.id}`,
    name,
    risk: 'safe',
    steps,
    version: 1
  }
}

function successfulRecording(status: MacroRecording['entries'][number]['status']): boolean {
  return ['accepted', 'confirmed', 'unconfirmed', 'already_satisfied'].includes(status)
}
